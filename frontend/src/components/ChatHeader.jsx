import { Phone, Video, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, isTyping, typingUserName } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callStatus } = useCallStore();

  const displayName = typingUserName || selectedUser.fullName;
  const isOnline =
    onlineUsers.includes(selectedUser._id) ||
    onlineUsers.includes(selectedUser._id.toString());
  const canCall = isOnline && callStatus === "idle";

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className={`text-sm ${isTyping ? "text-info animate-pulse" : "text-base-content/70"}`}>
              {isTyping ? (
                <>
                  <span className="font-medium">{displayName}</span> is typing
                  <span className="inline-flex w-5">
                    <span className="animate-bounce [animation-delay:0ms]">.</span>
                    <span className="animate-bounce [animation-delay:150ms]">.</span>
                    <span className="animate-bounce [animation-delay:300ms]">.</span>
                  </span>
                </>
              ) : isOnline ? (
                "Online"
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => startCall(selectedUser, "audio")}
            disabled={!canCall}
            className="btn btn-ghost btn-sm btn-circle"
            title="Voice call"
          >
            <Phone className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => startCall(selectedUser, "video")}
            disabled={!canCall}
            className="btn btn-ghost btn-sm btn-circle"
            title="Video call"
          >
            <Video className="size-4" />
          </button>
          <button type="button" onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-sm btn-circle">
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatHeader;
