import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallStore } from "../store/useCallStore";

const CallModal = () => {
  const {
    callStatus,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callStatus === "idle" || !remoteUser) return null;

  const isVideoCall = callType === "video";
  const isIncoming = callStatus === "incoming";
  const isCalling = callStatus === "calling";
  const isConnected = callStatus === "connected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl mx-4 bg-base-100 rounded-2xl overflow-hidden shadow-2xl">
        <div
          className={`relative bg-base-300 ${isVideoCall && isConnected ? "aspect-video" : "h-64"}`}
        >
          {isVideoCall && isConnected ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover border-2 border-white shadow-lg"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="avatar">
                <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img src={remoteUser.profilePic || "/avatar.png"} alt={remoteUser.fullName} />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">{remoteUser.fullName}</h3>
                <p className="text-base-content/70 mt-1">
                  {isIncoming && "Incoming call..."}
                  {isCalling && "Calling..."}
                  {isConnected && !isVideoCall && "Voice call connected"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex items-center justify-center gap-4">
          {isIncoming ? (
            <>
              <button
                type="button"
                onClick={rejectCall}
                className="btn btn-circle btn-lg bg-error text-error-content hover:bg-error/90"
                title="Decline"
              >
                <PhoneOff className="size-6" />
              </button>
              <button
                type="button"
                onClick={answerCall}
                className="btn btn-circle btn-lg bg-success text-success-content hover:bg-success/90"
                title="Accept"
              >
                <Phone className="size-6" />
              </button>
            </>
          ) : (
            <>
              {isConnected && (
                <>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`btn btn-circle btn-lg ${isMuted ? "btn-error" : "btn-ghost bg-base-200"}`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  {isVideoCall && (
                    <button
                      type="button"
                      onClick={toggleVideo}
                      className={`btn btn-circle btn-lg ${isVideoOff ? "btn-error" : "btn-ghost bg-base-200"}`}
                      title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    >
                      {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={endCall}
                className="btn btn-circle btn-lg bg-error text-error-content hover:bg-error/90"
                title="End call"
              >
                <PhoneOff className="size-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
