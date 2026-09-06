import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class ToolsPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen(
            [sys.executable, "-u", "-m", "http.server", "0", "--bind", "127.0.0.1"],
            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
        cls.addClassCleanup(cls.stop_server)
        startup = cls.server.stdout.readline()
        port = re.search(r"port (\d+)", startup).group(1)
        cls.base_url = f"http://127.0.0.1:{port}/"
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch()
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)
        cls.server.stdout.close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width": 1440, "height": 1000})
        self.page.set_default_timeout(3000)
        self.errors = []
        self.expected_http_error = False
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", self.capture_console)

    def capture_console(self, message):
        if message.type == "error":
            if self.expected_http_error and "503" in message.text:
                return
            self.errors.append(message.text)

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [], "Unexpected browser console/page errors")

    def open_catalog(self):
        self.page.goto(self.base_url)
        expect(self.page.locator("[data-tool-card]")).to_have_count(156)

    def test_tools_render_and_search(self):
        self.open_catalog()
        expect(self.page.get_by_role("heading", name="Open-source tools for protein science")).to_be_visible()
        search = self.page.get_by_role("searchbox", name="Search tools")
        search.fill("AlphaFold2")
        expect(self.page.locator("[data-tool-card] h2")).to_have_text(
            ["AlphaFold2", "RoseTTAFold2", "AF2Bind", "AFcluster"])
        expect(self.page.get_by_role("status")).to_contain_text("4 tools")
        search.fill("AF2Bind")
        expect(self.page.locator("[data-tool-card]")).to_have_count(1)
        expect(self.page.locator("[data-tool-card] h2")).to_have_text("AF2Bind")
        expect(self.page.get_by_role("status")).to_contain_text("1 tool")

    def test_filters_combine_toggle_and_clear(self):
        self.open_catalog()
        category = self.page.get_by_role("button", name="Protein Design", exact=True)
        category.click()
        expect(category).to_have_attribute("aria-pressed", "true")
        category_count = self.page.locator("[data-tool-card]").count()
        self.page.locator("#tag-filters summary").click()
        tag = self.page.get_by_role("button", name="Antibodies", exact=True)
        tag.click()
        expect(tag).to_have_attribute("aria-pressed", "true")
        visible = self.page.locator("[data-tool-card]").count()
        self.assertGreater(visible, 0)
        self.assertLess(visible, category_count)
        tag.click()
        expect(tag).to_have_attribute("aria-pressed", "false")
        expect(self.page.locator("[data-tool-card]")).to_have_count(category_count)
        self.page.get_by_role("searchbox", name="Search tools").fill("no-such-tool-897")
        self.page.get_by_role("button", name="Clear filters", exact=True).click()
        expect(self.page.locator("[data-tool-card]")).to_have_count(156)
        expect(category).to_have_attribute("aria-pressed", "false")
        expect(self.page.get_by_role("searchbox", name="Search tools")).to_have_value("")

    def test_no_results_and_clear_search(self):
        self.open_catalog()
        self.page.get_by_role("searchbox", name="Search tools").fill("no-such-tool-897")
        expect(self.page.locator("[data-tool-card]")).to_have_count(0)
        expect(self.page.get_by_role("heading", name="No tools found")).to_be_visible()
        expect(self.page.get_by_role("status")).to_contain_text("0 tools")
        self.page.get_by_role("button", name="Clear search", exact=True).click()
        expect(self.page.locator("[data-tool-card]")).to_have_count(156)

    def test_cards_are_safe_github_links(self):
        self.open_catalog()
        cards = self.page.locator("[data-tool-card]")
        for card in cards.all():
            self.assertTrue(card.get_attribute("href").startswith("https://github.com/"))
            self.assertEqual(card.get_attribute("target"), "_blank")
            self.assertIn("noopener", card.get_attribute("rel"))
            self.assertIn("noreferrer", card.get_attribute("rel"))
            self.assertRegex(card.inner_text(), r"official repository|GitHub repository search")
            self.assertTrue(card.locator("img").get_attribute("src").startswith("assets/tools/"))
            self.assertEqual(card.locator("img").get_attribute("loading"), "lazy")
        expect(cards.first.locator("img")).to_be_visible()
        self.page.wait_for_function("document.querySelector('[data-tool-card] img').naturalWidth > 0")

    def test_mobile_navigation_and_layout(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.open_catalog()
        menu = self.page.get_by_role("button", name="Open navigation")
        nav = self.page.get_by_role("navigation", name="Primary")
        expect(menu).to_have_attribute("aria-expanded", "false")
        expect(nav).to_be_hidden()
        menu.click()
        expect(menu).to_have_attribute("aria-expanded", "true")
        expect(nav).to_be_visible()
        self.assertEqual(nav.get_by_role("link").all_text_contents(),
                         ["Tools", "Papers", "Molecules", "Structure Prediction", "Design", "Property"])
        expect(nav.get_by_role("link", name="Tools", exact=True)).to_have_attribute("aria-current", "page")
        self.page.keyboard.press("Escape")
        expect(nav).to_be_hidden()
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        self.assertLess(self.page.locator("[data-tool-card]").first.bounding_box()["y"], 844)

    def test_placeholder_routes_have_only_the_requested_shell(self):
        routes = {
            "/papers/": "Papers",
            "/molecules/": "Molecules",
            "/structure-prediction/": "Structure Prediction",
            "/design/": "Design",
            "/property/": "Property",
        }
        for route, title in routes.items():
            with self.subTest(route=route):
                self.page.goto(self.base_url + route)
                self.assertEqual(self.page.title(), f"{title} | AI4Protein")
                self.assertEqual(self.page.get_by_role("heading", name=title).count(), 1)
                self.assertEqual(
                    self.page.get_by_role("link", name=title, exact=True).get_attribute("aria-current"),
                    "page",
                )
                self.assertEqual(
                    self.page.locator('nav[aria-label="Primary"] [aria-current="page"]').count(),
                    1,
                )
                self.assertEqual(self.page.locator("main > *").count(), 1)
                self.assertEqual(self.page.locator("main").inner_text().strip(), title)

    def test_loading_resolves_to_catalog(self):
        pending = []
        self.page.route("**/data/tools.json", lambda route: pending.append(route))
        self.page.goto(self.base_url, wait_until="domcontentloaded")
        expect(self.page.get_by_role("status")).to_contain_text("Loading tools")
        self.page.wait_for_timeout(100)
        self.assertEqual(len(pending), 1)
        pending[0].fulfill(path=str(ROOT / "data/tools.json"), content_type="application/json")
        expect(self.page.locator("[data-tool-card]")).to_have_count(156)
        expect(self.page.get_by_role("status")).not_to_contain_text("Loading")

    def test_fetch_error_replaces_loading(self):
        self.expected_http_error = True
        self.page.route("**/data/tools.json", lambda route: route.fulfill(status=503, body="Unavailable"))
        self.page.goto(self.base_url)
        expect(self.page.get_by_role("alert")).to_contain_text("Catalog unavailable")
        expect(self.page.get_by_role("status")).not_to_contain_text("Loading")
        expect(self.page.locator("[data-tool-card]")).to_have_count(0)

    def test_malformed_catalog_shows_error(self):
        self.page.route("**/data/tools.json", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps({"unexpected": []})))
        self.page.goto(self.base_url)
        expect(self.page.get_by_role("alert")).to_contain_text("Catalog unavailable")
        expect(self.page.get_by_role("status")).not_to_contain_text("Loading")


if __name__ == "__main__":
    unittest.main()
