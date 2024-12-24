import PocketBase from "pocketbase";

const pb = new PocketBase(import.meta.env.PB_URL);

export default pb;
