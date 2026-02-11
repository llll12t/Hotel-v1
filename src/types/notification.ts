
export interface Notification {
    id: string;
    isRead: boolean;
    createdAt?: any;
    title?: string;
    message?: string;
    type?: string;
    [key: string]: any;
}
