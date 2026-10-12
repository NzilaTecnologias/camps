export type StreamEmbed = { provider: "YouTube" | "Facebook"; embedUrl: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"]);
const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * Converte o endereço de uma transmissão no endereço do leitor para embutir na página.
 * Só aceita YouTube e Facebook: o que o organizador cola nunca vai direto para um iframe.
 */
export function parseStreamUrl(input: string): StreamEmbed | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const id =
      url.hostname === "youtu.be"
        ? segments[0]
        : segments[0] === "watch"
          ? url.searchParams.get("v")
          : ["live", "embed", "shorts"].includes(segments[0])
            ? segments[1]
            : null;
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return { provider: "YouTube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  if (FACEBOOK_HOSTS.has(url.hostname)) {
    const isVideo = url.hostname === "fb.watch" || /\/videos\/|\/watch\/?$|\/live\//.test(url.pathname);
    if (!isVideo) return null;
    const href = encodeURIComponent(url.toString());
    return { provider: "Facebook", embedUrl: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false` };
  }

  return null;
}
