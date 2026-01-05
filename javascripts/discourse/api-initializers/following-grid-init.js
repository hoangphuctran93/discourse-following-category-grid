import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
    api.onPageChange((url, title) => {
        // Check key from settings (default "following")
        const settingValue = settings.following_grid_category || "following";
        const targets = settingValue.split(",").map(t => t.trim()).filter(Boolean);

        // Check if URL contains /c/target (slug) or /c/.../target (ID)
        const isTargetPage = targets.some(target => {
            return url.includes(`/c/${target}`) ||
                (url.match(/\/c\/.*\/(\d+)/) && url.match(/\/c\/.*\/(\d+)/)[1] === target);
        });

        const body = document.querySelector("body");

        if (isTargetPage) {
            body.classList.add("custom-following-page");
        } else {
            body.classList.remove("custom-following-page");
        }
    });
});
