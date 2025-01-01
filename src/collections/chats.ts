import type { RecordModel } from "pocketbase";
import pb from "../pocketbase";

export const chats = pb.collection("chats");

export interface ChatModel extends RecordModel {
	members: string[];
	name: string;
	photo: string;
	theme: string;
}
