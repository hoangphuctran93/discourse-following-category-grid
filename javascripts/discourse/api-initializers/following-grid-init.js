import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
    api.onPageChange((url, title) => {
        // Check key from settings (default "following")
        const target = settings.following_grid_category || "following";

        // Check if URL contains /c/target (slug) or /c/.../target (ID)
        // Basic check: is "target" part of the URL path segments for category?
        // We can be a bit loose or strict.
        // Strict: 
        //   /c/slug
        //   /c/slug/id

        // Simple check:
        const isTargetPage = url.includes(`/c/${target}`) ||
            (url.match(/\/c\/.*\/(\d+)/) && url.match(/\/c\/.*\/(\d+)/)[1] === target);

        const body = document.querySelector("body");

        if (isTargetPage) {
            body.classList.add("custom-following-page");
        } else {
            body.classList.remove("custom-following-page");
        }
    });
});
