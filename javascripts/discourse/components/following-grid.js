import Component from "@glimmer/component";

export default class FollowingGrid extends Component {
  get gridItems() {
    const topics = this.args.topics || [];
    
    // Gradients for random gradient borders
    const gradients = [
      "linear-gradient(to right, #3b82f6, #6366f1)", // blue to indigo
      "linear-gradient(to right, #a855f7, #ec4899)", // purple to pink
      "linear-gradient(to right, #f97316, #ef4444)", // orange to red
      "linear-gradient(to right, #14b8a6, #22c55e)"  // teal to green
    ];

    return topics.map((topic, index) => {
      const posters = topic.posters || [];
      const opPoster = posters.find((p) => p.description.includes("Original Poster")) || posters[0];
      const user = opPoster && opPoster.user ? opPoster.user : null;
      
      let avatarUrl = "";
      if (user && user.avatar_template) {
         avatarUrl = user.avatar_template.replace("{size}", "200");
         if (!avatarUrl.startsWith("http")) {
            avatarUrl = window.location.origin + avatarUrl; 
         }
      }

      return {
        id: topic.id,
        title: topic.title,
        categoryName: topic.category ? topic.category.name : "General",
        username: user ? user.username : "Unknown",
        name: user ? user.name : topic.last_poster_username,
        avatarUrl: avatarUrl,
        likes: topic.like_count || 0,
        url: `/t/${topic.slug}/${topic.id}`,
        gradientStyle: gradients[index % gradients.length]
      };
    });
  }
}
