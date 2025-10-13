import pyaudio
import streamlit as st
from streamlit_webrtc import WebRtcMode, webrtc_streamer
import os
import logging
from twilio.rest import Client

st.header("Audio Frame Test")

logger = logging.getLogger(__name__)


def get_ice_servers():
    """Use Twilio's TURN server because Streamlit Community Cloud has changed
    its infrastructure and WebRTC connection cannot be established without TURN server now.  # noqa: E501
    We considered Open Relay Project (https://www.metered.ca/tools/openrelay/) too,
    but it is not stable and hardly works as some people reported like https://github.com/aiortc/aiortc/issues/832#issuecomment-1482420656  # noqa: E501
    See https://github.com/whitphx/streamlit-webrtc/issues/1213
    """

    # Ref: https://www.twilio.com/docs/stun-turn/api
    try:
        account_sid = os.environ["TWILIO_ACCOUNT_SID"]
        auth_token = os.environ["TWILIO_AUTH_TOKEN"]
    except KeyError:
        logger.warning(
            "Twilio credentials are not set. Fallback to a free STUN server from Google."  # noqa: E501
        )
        return [{"urls": ["stun:stun.l.google.com:19302"]}]

    client = Client(account_sid, auth_token)

    token = client.tokens.create()

    return token.ice_servers



webrtc_ctx = webrtc_streamer(
    key="speech-to-text",
    mode=WebRtcMode.SENDONLY,
    audio_receiver_size=1024,
    rtc_configuration={"iceServers": get_ice_servers()},
    media_stream_constraints={"video": False, "audio": True},
)
print("Webrtc_ctx: ", webrtc_ctx)

if not webrtc_ctx.state.playing:
    print("not")

if st.button("Get Frame"):
    print("1")
    if webrtc_ctx.audio_receiver:
        data = webrtc_ctx.audio_receiver.get_frame()
        print("Webrtc Frame: ",data.read)