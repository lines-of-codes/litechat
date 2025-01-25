import type { RecordModel } from "pocketbase";
import pb from "../pocketbase";

export const messages = pb.collection("messages");

export interface MessageModel extends RecordModel {
	sender: string;
	chat: string;
	content: string;
	attachments: string[] | File[];
	iv: string;
	created: string;
}
