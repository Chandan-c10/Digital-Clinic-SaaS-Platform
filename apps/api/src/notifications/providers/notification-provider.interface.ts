export interface NotificationDispatchResult {
  status: "SENT" | "FAILED";
  error?: string;
}

export interface NotificationProvider {
  send(recipient: string, subject: string | undefined, body: string): Promise<NotificationDispatchResult>;
}
