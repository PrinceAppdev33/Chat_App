import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export const useCallStore = create((set, get) => ({
  callStatus: "idle",
  callType: "video",
  remoteUser: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  incomingSignal: null,
  isMuted: false,
  isVideoOff: false,
  listenersInitialized: false,

  initCallListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket || get().listenersInitialized) return;

    socket.on("incomingCall", ({ signal, callType, callerId, callerName }) => {
      if (get().callStatus !== "idle") {
        socket.emit("rejectCall", { receiverId: callerId });
        return;
      }

      const users = useChatStore.getState().users;
      const caller = users.find((u) => u._id.toString() === callerId.toString());

      set({
        callStatus: "incoming",
        callType,
        remoteUser: caller || { _id: callerId, fullName: callerName },
        incomingSignal: signal,
      });
    });

    socket.on("callAccepted", async ({ signal }) => {
      const { peerConnection } = get();
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        set({ callStatus: "connected" });
      } catch (error) {
        console.error("Failed to accept call:", error);
        get().endCall();
      }
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Failed to add ICE candidate:", error);
        }
      }
    });

    socket.on("callEnded", () => get().cleanupCall());
    socket.on("callRejected", () => {
      toast.error("Call declined");
      get().cleanupCall();
    });

    set({ listenersInitialized: true });
  },

  createPeerConnection: (receiverId) => {
    const socket = useAuthStore.getState().socket;
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", { receiverId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      set({ remoteStream: event.streams[0] });
    };

    return pc;
  },

  startCall: async (user, callType = "video") => {
    const socket = useAuthStore.getState().socket;
    const { onlineUsers } = useAuthStore.getState();

    if (!onlineUsers.includes(user._id.toString()) && !onlineUsers.includes(user._id)) {
      toast.error("User is offline");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const pc = get().createPeerConnection(user._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { authUser } = useAuthStore.getState();
      socket.emit("callUser", {
        receiverId: user._id,
        signal: offer,
        callType,
        callerId: authUser._id,
        callerName: authUser.fullName,
      });

      set({
        callStatus: "calling",
        callType,
        remoteUser: user,
        localStream: stream,
        peerConnection: pc,
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      toast.error("Could not access camera/microphone");
      get().cleanupCall();
    }
  },

  answerCall: async () => {
    const socket = useAuthStore.getState().socket;
    const { incomingSignal, callType, remoteUser } = get();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const pc = get().createPeerConnection(remoteUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", {
        receiverId: remoteUser._id,
        signal: answer,
      });

      set({
        callStatus: "connected",
        localStream: stream,
        peerConnection: pc,
        incomingSignal: null,
      });
    } catch (error) {
      console.error("Failed to answer call:", error);
      toast.error("Could not answer call");
      get().rejectCall();
    }
  },

  rejectCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (remoteUser) {
      socket.emit("rejectCall", { receiverId: remoteUser._id });
    }
    get().cleanupCall();
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (remoteUser) {
      socket.emit("endCall", { receiverId: remoteUser._id });
    }
    get().cleanupCall();
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    set({ isMuted: !isMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = isVideoOff;
    });
    set({ isVideoOff: !isVideoOff });
  },

  cleanupCall: () => {
    const { localStream, peerConnection } = get();
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnection?.close();

    set({
      callStatus: "idle",
      remoteUser: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      incomingSignal: null,
      isMuted: false,
      isVideoOff: false,
    });
  },
}));
