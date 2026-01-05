import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
    api.onPageChange((url, title) => {
        // Check key from settings (type: list uses pipe separator)
        const settingValue = settings.following_grid_category;

        if (!settingValue) return;

        let targets;
        if (Array.isArray(settingValue)) {
            targets = settingValue.map(t => t.toString());
        } else {
            targets = settingValue.toString().split("|").map(t => t.trim());
        }
        targets = targets.filter(Boolean);

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
