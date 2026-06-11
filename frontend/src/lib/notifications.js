export const getNotificationPermission = () => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
};

export const showMessageNotification = ({ title, body, icon, onClick }) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;

  const notification = new Notification(title, {
    body,
    icon: icon || "/avatar.png",
    tag: "chat-message",
  });

  notification.onclick = () => {
    window.focus();
    onClick?.();
    notification.close();
  };
};
