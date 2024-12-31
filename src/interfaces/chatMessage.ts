export interface ChatMessage {
	id: string;
	sender: string;
	senderId: string;
	/// Processed content
	content: string;
	rawContent: string;
	attachments: string[];
	created: string;
}
