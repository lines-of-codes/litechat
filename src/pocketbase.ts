import PocketBase from "pocketbase";

const pb = new PocketBase(import.meta.env.VITE_PB_URL);
export let thisUserId: string;

pb.authStore.onChange((_token, record) => {
	if (record === null) return;

	thisUserId = record.id;
}, true);

export default pb;
