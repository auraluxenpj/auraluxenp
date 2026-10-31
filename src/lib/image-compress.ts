import { compressToWebp } from "@/lib/image-compress";

// before uploading:
const webp = await compressToWebp(file);               // 1600px max, quality 0.82
// then use `webp` instead of `file`, and use its name/extension for the path:
const path = `products/${Date.now()}-${webp.name}`;
await supabase.storage.from("YOUR_BUCKET").upload(path, webp, { contentType: webp.type });
