from __future__ import annotations

import json
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
from collections import Counter
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import websocket

ROOT = Path(__file__).resolve().parent
CHROME = Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")


class RecordingHandler(SimpleHTTPRequestHandler):
    requests: list[str] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - stdlib API
        self.requests.append(self.path.split("?", 1)[0])
        super().do_GET()

    def log_message(self, format: str, *args: Any) -> None:
        pass


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class CDP:
    def __init__(self, websocket_url: str) -> None:
        self.socket = websocket.create_connection(
            websocket_url,
            timeout=10,
            origin="http://localhost",
        )
        self.next_id = 1

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        command_id = self.next_id
        self.next_id += 1
        self.socket.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        while True:
            response = json.loads(self.socket.recv())
            if response.get("id") == command_id:
                if "error" in response:
                    raise RuntimeError(f"CDP {method} failed: {response['error']}")
                return response.get("result", {})

    def evaluate(self, expression: str) -> Any:
        result = self.call(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": True,
            },
        )
        return result["result"].get("value")

    def close(self) -> None:
        self.socket.close()


def wait_for(predicate, timeout: float = 10.0, interval: float = 0.1) -> Any:
    deadline = time.time() + timeout
    last_value = None
    while time.time() < deadline:
        last_value = predicate()
        if last_value:
            return last_value
        time.sleep(interval)
    raise TimeoutError(f"Condition did not become true; last value: {last_value!r}")


def main() -> None:
    if not CHROME.exists():
        raise FileNotFoundError(CHROME)

    RecordingHandler.requests = []
    server_port = free_port()
    debug_port = free_port()
    server = ThreadingHTTPServer(("127.0.0.1", server_port), RecordingHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    with tempfile.TemporaryDirectory(prefix="np-items-chrome-") as profile_dir:
        process = subprocess.Popen(
            [
                str(CHROME),
                "--headless=new",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-networking",
                "--no-first-run",
                "--no-default-browser-check",
                "--remote-allow-origins=*",
                f"--remote-debugging-port={debug_port}",
                f"--user-data-dir={profile_dir}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        cdp: CDP | None = None
        try:
            def get_target() -> dict[str, Any] | None:
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{debug_port}/json/list", timeout=1) as response:
                        targets = json.load(response)
                    return next((target for target in targets if target.get("type") == "page"), None)
                except Exception:
                    return None

            target = wait_for(get_target)
            cdp = CDP(target["webSocketDebuggerUrl"])
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            cdp.call("Page.navigate", {"url": f"http://127.0.0.1:{server_port}/index.html"})

            wait_for(lambda: cdp.evaluate("document.readyState === 'complete'"))
            wait_for(lambda: cdp.evaluate("document.querySelectorAll('#itemsTable tbody tr').length === 50"))

            initial_rows = cdp.evaluate("document.querySelectorAll('#itemsTable tbody tr').length")
            initial_status = cdp.evaluate("document.querySelector('#table-status').textContent")
            total_items = cdp.evaluate("state.items.length")
            first_item = cdp.evaluate("document.querySelector('#itemsTable tbody tr td').textContent")
            time.sleep(0.75)
            initial_request_counts = Counter(RecordingHandler.requests)
            initial_image_requests = sum(
                count for path, count in initial_request_counts.items() if path.startswith("/images/")
            )

            expected_items = len(json.loads((ROOT / "items_data.json").read_text(encoding="utf-8")))
            if total_items != expected_items:
                raise AssertionError(f"Expected {expected_items} items, got {total_items}")
            if initial_rows != 50:
                raise AssertionError(f"Expected 50 initial rows, got {initial_rows}")
            if f"Showing 1-50 of {expected_items} items" not in initial_status:
                raise AssertionError(f"Unexpected initial status: {initial_status!r}")
            if initial_image_requests > 50:
                raise AssertionError(f"Too many first-load image requests: {initial_image_requests}")

            column_labels = cdp.evaluate(
                "[...document.querySelectorAll('#checkbox-container .column-label')].map(label => label.textContent)"
            )
            alphabetized_labels = cdp.evaluate("""
                (() => {
                    const labels = [...document.querySelectorAll('#checkbox-container .column-label')]
                        .map(label => label.textContent);
                    return labels.every((label, index) => index === 0 ||
                        labels[index - 1].localeCompare(label, undefined, {
                            numeric: true,
                            sensitivity: 'base'
                        }) <= 0);
                })()
            """)
            if not alphabetized_labels:
                raise AssertionError(f"Column picker is not alphabetized: {column_labels}")

            expected_basic_columns = {
                "Item Name", "Image", "Max Damage", "Stats", "Hidden Effect(s)", "Spec. Req.",
                "Lvl Req.", "Location/Boss/Event", "Type", "Slot", "Other Notes", "EV"
            }
            selected_columns = set(cdp.evaluate("""
                [...document.querySelectorAll('#checkbox-container .column-checkbox:checked')]
                    .map(checkbox => document.querySelector(`label[for="${checkbox.id}"]`).textContent)
            """))
            if selected_columns != expected_basic_columns:
                raise AssertionError(f"Unexpected default basic columns: {selected_columns}")
            if not cdp.evaluate("document.querySelector('#basic-view').getAttribute('aria-pressed') === 'true'"):
                raise AssertionError("Basic View is not active by default")

            cdp.evaluate("document.querySelector('#toggle-columns').click()")
            wait_for(lambda: cdp.evaluate(
                "document.querySelectorAll('#checkbox-container .column-checkbox:checked').length === headers.length"
            ))
            cdp.evaluate("document.querySelector('#basic-view').click()")
            wait_for(lambda: cdp.evaluate(
                "document.querySelectorAll('#checkbox-container .column-checkbox:checked').length === 12"
            ))

            first_headers = cdp.evaluate(
                "[...document.querySelectorAll('#itemsTable thead th')].slice(0, 4).map(cell => cell.textContent)"
            )
            if first_headers != ["Item Name", "Image", "Max Damage", "Stats"]:
                raise AssertionError(f"Unexpected leading column order: {first_headers}")

            katana_max_damage = cdp.evaluate(
                "state.items.find(item => item['Item Name'] === 'Katana of Severing')._maxDamage"
            )
            if katana_max_damage != 73:
                raise AssertionError(f"Unexpected Katana of Severing max damage: {katana_max_damage}")

            cdp.evaluate("document.querySelector('th[data-column=\"2\"]').click()")
            cdp.evaluate("document.querySelector('th[data-column=\"2\"]').click()")
            wait_for(lambda: cdp.evaluate(
                "document.querySelector('th[data-column=\"2\"]').getAttribute('aria-sort') === 'descending'"
            ))
            visible_damage = cdp.evaluate("""
                [...document.querySelectorAll('#itemsTable tbody tr td:nth-child(3)')]
                    .map(cell => cell.textContent.trim())
                    .filter(Boolean)
                    .map(Number)
            """)
            if not visible_damage or any(
                left < right for left, right in zip(visible_damage, visible_damage[1:])
            ):
                raise AssertionError(f"Max Damage is not sorted descending: {visible_damage}")

            wait_for(lambda: cdp.evaluate(
                "document.querySelector('#table-scrollbar-spacer').offsetWidth === "
                "document.querySelector('#table-scroll-container').scrollWidth"
            ))
            cdp.evaluate("""
                (() => {
                    const scrollbar = document.querySelector('#table-scrollbar');
                    scrollbar.scrollLeft = 500;
                    scrollbar.dispatchEvent(new Event('scroll'));
                    return true;
                })()
            """)
            wait_for(lambda: cdp.evaluate(
                "document.querySelector('#table-scroll-container').scrollLeft === 500"
            ))
            cdp.evaluate("""
                (() => {
                    const table = document.querySelector('#table-scroll-container');
                    table.scrollLeft = 250;
                    table.dispatchEvent(new Event('scroll'));
                    return true;
                })()
            """)
            wait_for(lambda: cdp.evaluate(
                "document.querySelector('#table-scrollbar').scrollLeft === 250"
            ))

            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 2400,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False,
            })
            wait_for(lambda: cdp.evaluate("document.querySelector('main.container').clientWidth > 2200"))
            wide_visible_columns = cdp.evaluate("""
                (() => {
                    const viewport = document.querySelector('#table-scroll-container').getBoundingClientRect();
                    return [...document.querySelectorAll('#itemsTable thead th')]
                        .filter(cell => {
                            const rect = cell.getBoundingClientRect();
                            return rect.width > 0 && rect.left < viewport.right;
                        }).length;
                })()
            """)

            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 900,
                "height": 700,
                "deviceScaleFactor": 1,
                "mobile": False,
            })
            narrow_visible_columns = cdp.evaluate("""
                (() => {
                    const viewport = document.querySelector('#table-scroll-container').getBoundingClientRect();
                    return [...document.querySelectorAll('#itemsTable thead th')]
                        .filter(cell => {
                            const rect = cell.getBoundingClientRect();
                            return rect.width > 0 && rect.left < viewport.right;
                        }).length;
                })()
            """)
            if wide_visible_columns <= narrow_visible_columns:
                raise AssertionError(
                    f"Responsive width did not reveal more columns: wide={wide_visible_columns}, "
                    f"narrow={narrow_visible_columns}"
                )

            table_point = cdp.evaluate("""
                (() => {
                    const table = document.querySelector('#table-scroll-container');
                    const targetY = window.scrollY + table.getBoundingClientRect().top;
                    document.documentElement.style.scrollBehavior = 'auto';
                    window.scrollTo(0, targetY);
                    const rect = table.getBoundingClientRect();
                    return {
                        x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + 100)),
                        y: Math.max(50, Math.min(window.innerHeight - 1, rect.top + 150)),
                        scrollY: window.scrollY
                    };
                })()
            """)
            cdp.call("Input.dispatchMouseEvent", {
                "type": "mouseWheel",
                "x": table_point["x"],
                "y": table_point["y"],
                "deltaX": 0,
                "deltaY": 450,
            })
            wait_for(lambda: cdp.evaluate("window.scrollY") > table_point["scrollY"])
            sticky_scrollbar_top = cdp.evaluate(
                "document.querySelector('#table-scrollbar').getBoundingClientRect().top"
            )
            if sticky_scrollbar_top > 1:
                raise AssertionError(f"Top scrollbar is not sticky: top={sticky_scrollbar_top}")

            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 1,
                "mobile": True,
            })
            wait_for(lambda: cdp.evaluate("window.innerWidth === 390"))
            mobile_layout = cdp.evaluate("""
                (() => {
                    const controls = document.querySelector('.primary-controls').getBoundingClientRect();
                    const table = document.querySelector('#table-scroll-container');
                    const firstCell = document.querySelector('#itemsTable tbody td:first-child');
                    table.scrollLeft = 300;
                    table.dispatchEvent(new Event('scroll'));
                    const firstCellRect = firstCell.getBoundingClientRect();
                    const tableRect = table.getBoundingClientRect();
                    return {
                        documentWidth: document.documentElement.scrollWidth,
                        viewportWidth: window.innerWidth,
                        controlsRight: controls.right,
                        tableScrollable: table.scrollWidth > table.clientWidth,
                        touchAction: getComputedStyle(table).touchAction,
                        firstColumnSticky: Math.abs(firstCellRect.left - tableRect.left) < 2,
                        basicButtonHeight: document.querySelector('#basic-view').getBoundingClientRect().height,
                        scrollbarVisible: document.querySelector('#table-scrollbar').getBoundingClientRect().height > 0
                    };
                })()
            """)
            if mobile_layout["documentWidth"] > mobile_layout["viewportWidth"]:
                raise AssertionError(f"Mobile page overflows horizontally: {mobile_layout}")
            if mobile_layout["controlsRight"] > mobile_layout["viewportWidth"] + 1:
                raise AssertionError(f"Mobile controls exceed viewport: {mobile_layout}")
            if not mobile_layout["tableScrollable"]:
                raise AssertionError(f"Mobile table is not horizontally scrollable: {mobile_layout}")
            if "pan-x" not in mobile_layout["touchAction"] or "pan-y" not in mobile_layout["touchAction"]:
                raise AssertionError(f"Mobile table touch scrolling is not enabled: {mobile_layout}")
            if not mobile_layout["firstColumnSticky"]:
                raise AssertionError(f"Mobile first column is not sticky: {mobile_layout}")
            if mobile_layout["basicButtonHeight"] < 44:
                raise AssertionError(f"Mobile controls are too small for touch: {mobile_layout}")
            if not mobile_layout["scrollbarVisible"]:
                raise AssertionError(f"Mobile horizontal scrollbar is hidden: {mobile_layout}")

            cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 900,
                "height": 700,
                "deviceScaleFactor": 1,
                "mobile": False,
            })
            wait_for(lambda: cdp.evaluate("window.innerWidth === 900"))

            cdp.evaluate("""
                (() => {
                    const input = document.querySelector('#item-search');
                    input.value = 'Flame Woven Helm';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                })()
            """)
            wait_for(lambda: cdp.evaluate("document.querySelectorAll('#itemsTable tbody tr').length === 1"))
            search_name = cdp.evaluate("document.querySelector('#itemsTable tbody tr td').textContent")
            if search_name != "Flame Woven Helm":
                raise AssertionError(f"Search returned {search_name!r}")

            cdp.evaluate("""
                (() => {
                    const input = document.querySelector('#item-search');
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                })()
            """)
            wait_for(lambda: cdp.evaluate("document.querySelectorAll('#itemsTable tbody tr').length === 50"))

            cdp.evaluate("document.querySelector('#pagination-top button[data-page-action=\"next\"]').click()")
            wait_for(lambda: "Showing 51-100" in str(cdp.evaluate("document.querySelector('#table-status').textContent")))
            page_two_first_item = cdp.evaluate("document.querySelector('#itemsTable tbody tr td').textContent")
            if page_two_first_item == first_item:
                raise AssertionError("Pagination did not change the visible records")

            cdp.evaluate("document.querySelector('th[data-column=\"0\"]').click()")
            wait_for(lambda: cdp.evaluate("document.querySelector('th[data-column=\"0\"]').getAttribute('aria-sort') === 'ascending'"))

            cdp.evaluate("""
                (() => {
                    const image = document.querySelector('img.item-thumbnail:not(.placeholder-thumbnail)');
                    if (!image) return false;
                    image.click();
                    return true;
                })()
            """)
            wait_for(lambda: cdp.evaluate("Boolean(document.querySelector('.overlay'))"))
            cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
            wait_for(lambda: cdp.evaluate("!document.querySelector('.overlay')"))

            resource_images = cdp.evaluate("performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'img').length")
            request_counts = Counter(RecordingHandler.requests)
            image_requests = sum(count for path, count in request_counts.items() if path.startswith("/images/"))
            if image_requests >= 100:
                raise AssertionError(f"Too many image requests during smoke test: {image_requests}")

            print(f"Initial rows: {initial_rows}")
            print(f"Catalog items: {total_items}")
            print(f"First-load image requests: {initial_image_requests}")
            print(f"Initial status: {initial_status}")
            print(f"Search result: {search_name}")
            print(f"Page 2 first item: {page_two_first_item}")
            print(f"Browser image resources: {resource_images}")
            print(f"Server image requests: {image_requests}")
            print(f"Total HTTP requests: {sum(request_counts.values())}")
            print("Browser smoke test passed.")
        finally:
            if cdp is not None:
                cdp.close()
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
