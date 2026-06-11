import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { showMessageNotification } from "../lib/notifications";

const updateMessageById = (messages, updatedMessage) =>
  messages.map((msg) =>
    msg._id.toString() === updatedMessage._id.toString() ? updatedMessage : msg
  );

const isMessageInChat = (message, selectedUserId, authUserId) => {
  const sender = message.senderId.toString();
  const receiver = message.receiverId.toString();
  const partner = selectedUserId.toString();
  const me = authUserId.toString();
  return (sender === me && receiver === partner) || (sender === partner && receiver === me);
};

const buildUnreadCounts = (users) => {
  const counts = {};
  users.forEach((user) => {
    if (user.unreadCount > 0) {
      counts[user._id.toString()] = user.unreadCount;
    }
  });
  return counts;
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  typingUserName: "",
  unreadCounts: {},
  globalListenerActive: false,

  getTotalUnread: () => {
    const { unreadCounts } = get();
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  },

  incrementUnread: (senderId) => {
    const id = senderId.toString();
    set({
      unreadCounts: {
        ...get().unreadCounts,
        [id]: (get().unreadCounts[id] || 0) + 1,
      },
    });
  },

  clearUnread: (userId) => {
    const id = userId.toString();
    const { unreadCounts } = get();
    if (!unreadCounts[id]) return;
    const updated = { ...unreadCounts };
    delete updated[id];
    set({ unreadCounts: updated });
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({
        users: res.data,
        unreadCounts: buildUnreadCounts(res.data),
      });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });

      get().clearUnread(userId);

      const hasUnread = res.data.some(
        (msg) => msg.senderId.toString() === userId.toString() && !msg.isRead
      );
      if (hasUnread) {
        await get().markMessagesAsRead(userId);
      }
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  markMessagesAsRead: async (senderId) => {
    try {
      const res = await axiosInstance.put(`/messages/read/${senderId}`);
      const { messageIds } = res.data;

      get().clearUnread(senderId);

      if (messageIds?.length > 0) {
        const readIds = messageIds.map((id) => id.toString());
        set({
          messages: get().messages.map((msg) =>
            readIds.includes(msg._id.toString())
              ? { ...msg, isRead: true, readAt: new Date() }
              : msg
          ),
        });
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}/react`, { emoji });
      set({ messages: updateMessageById(get().messages, res.data) });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to react");
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}`, { text });
      set({ messages: updateMessageById(get().messages, res.data) });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to edit message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      set({ messages: updateMessageById(get().messages, res.data) });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete message");
    }
  },

  handleIncomingMessage: (newMessage) => {
    const { selectedUser, users } = get();
    const authUserId = useAuthStore.getState().authUser?._id;
    const senderId = newMessage.senderId.toString();

    const isFromSelectedChat =
      selectedUser && senderId === selectedUser._id.toString();

    if (isFromSelectedChat) {
      set({ messages: [...get().messages, newMessage] });
      get().markMessagesAsRead(selectedUser._id);
      return;
    }

    get().incrementUnread(senderId);

    const sender = users.find((u) => u._id.toString() === senderId);
    const senderName = sender?.fullName || "Someone";
    const preview = newMessage.text
      ? newMessage.text
      : newMessage.audio
        ? "🎤 Voice message"
        : newMessage.image
          ? "📷 Photo"
          : "New message";

    showMessageNotification({
      title: senderName,
      body: preview,
      icon: sender?.profilePic,
      onClick: () => {
        if (sender) get().setSelectedUser(sender);
      },
    });
  },

  subscribeToGlobalEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket || get().globalListenerActive) return;

    socket.on("newMessage", get().handleIncomingMessage);
    set({ globalListenerActive: true });
  },

  unsubscribeFromGlobalEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    set({ globalListenerActive: false });
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    const authUserId = useAuthStore.getState().authUser._id;

    socket.on("messagesRead", ({ messageIds, readAt }) => {
      const readIds = messageIds.map((id) => id.toString());
      set({
        messages: get().messages.map((msg) =>
          readIds.includes(msg._id.toString())
            ? { ...msg, isRead: true, readAt: readAt || new Date() }
            : msg
        ),
      });
    });

    socket.on("userTyping", ({ senderId, senderName }) => {
      if (senderId.toString() !== selectedUser._id.toString()) return;
      set({ isTyping: true, typingUserName: senderName || selectedUser.fullName });
    });

    socket.on("userStoppedTyping", (senderId) => {
      if (senderId.toString() !== selectedUser._id.toString()) return;
      set({ isTyping: false, typingUserName: "" });
    });

    socket.on("messageReaction", (updatedMessage) => {
      if (!isMessageInChat(updatedMessage, selectedUser._id, authUserId)) return;
      set({ messages: updateMessageById(get().messages, updatedMessage) });
    });

    socket.on("messageEdited", (updatedMessage) => {
      if (!isMessageInChat(updatedMessage, selectedUser._id, authUserId)) return;
      set({ messages: updateMessageById(get().messages, updatedMessage) });
    });

    socket.on("messageDeleted", (updatedMessage) => {
      if (!isMessageInChat(updatedMessage, selectedUser._id, authUserId)) return;
      set({ messages: updateMessageById(get().messages, updatedMessage) });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;

    socket.off("messagesRead");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("messageReaction");
    socket.off("messageEdited");
    socket.off("messageDeleted");

    set({ isTyping: false, typingUserName: "" });
  },

  setSelectedUser: (selectedUser) => {
    if (selectedUser) get().clearUnread(selectedUser._id);
    set({ selectedUser, isTyping: false, typingUserName: "" });
  },
}));
