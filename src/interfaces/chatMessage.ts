export interface ChatMessage {
	id: string;
	chatId: string;
	sender: string;
	senderId: string;
	/// Processed content
	content: string;
	rawContent: string;
	iv: string;
	attachments: string[] | File[];
	created: string;
}
