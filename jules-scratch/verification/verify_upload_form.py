from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000/dashboard/upload-model", timeout=30000)

        page.get_by_role("button", name="Deploy New Model").click()

        # Wait for the dialog to appear, using its title
        expect(page.get_by_role("dialog", name="Deploy New Model")).to_be_visible(timeout=10000)

        # Now that the dialog is visible, proceed with the test
        page.get_by_role("combobox").click()
        page.get_by_role("option", name="Hugging Face").click()

        expect(page.get_by_label("Hugging Face Model ID *")).to_be_visible(timeout=5000)

        page.screenshot(path="jules-scratch/verification/upload_model_form.png")

        browser.close()

if __name__ == "__main__":
    run()
