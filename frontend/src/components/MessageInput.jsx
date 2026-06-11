import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Mic, Send, Square, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

const MessageInput = () => {
  const { authUser, socket } = useAuthStore();
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef(null);
  const { sendMessage, selectedUser } = useChatStore();

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
    };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const emitStopTyping = () => {
    socket?.emit("stopTyping", {
      receiverId: selectedUser._id,
      senderId: authUser._id,
    });
    clearTimeout(typingTimeoutRef.current);
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(recordingTimerRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            await sendMessage({ audio: reader.result });
          } catch (error) {
            console.error("Failed to send voice message:", error);
          }
        };
        reader.readAsDataURL(audioBlob);

        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() && !imagePreview) return;

    emitStopTyping();

    try {
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });

      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {isRecording && (
        <div className="mb-3 flex items-center gap-3 p-3 rounded-lg bg-error/10 border border-error/20">
          <span className="size-3 bg-error rounded-full animate-pulse" />
          <span className="text-sm font-medium text-error">
            Recording {formatRecordingTime(recordingTime)}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="btn btn-xs btn-error ml-auto gap-1"
          >
            <Square className="size-3 fill-current" />
            Send
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            disabled={isRecording}
            onChange={(e) => {
              setText(e.target.value);

              socket?.emit("typing", {
                receiverId: selectedUser._id,
                senderId: authUser._id,
                senderName: authUser.fullName,
              });

              clearTimeout(typingTimeoutRef.current);

              typingTimeoutRef.current = setTimeout(() => {
                socket?.emit("stopTyping", {
                  receiverId: selectedUser._id,
                  senderId: authUser._id,
                });
              }, 1000);
            }}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className={`btn btn-circle ${isRecording ? "btn-error text-error-content" : "text-zinc-400"}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!!imagePreview}
            title={isRecording ? "Stop and send" : "Record voice message"}
          >
            {isRecording ? <Square size={18} className="fill-current" /> : <Mic size={20} />}
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={(!text.trim() && !imagePreview) || isRecording}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
