import streamlit as st
from deepgramcomp import deepgramcomp
import streamlit.components.v1 as components
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch, Part
import random
import json
import os
from threading import Timer
import csv
import datetime
import time
import PIL
import io
from pathlib import Path
import sys

# valueeee = browser_detection_engine()
# st.write(valueeee)

print("rerun :", datetime.datetime.now().strftime("%H:%M:%S"))


settings = st.Page("seiten/settings.py", title="Settings", icon=":material/settings:")
photo = st.Page("seiten/settings.py", title="Photo", icon=":material/camera:")
stg = st.Page("seiten/stg.py", title="STG", icon=":material/camera:")
test = st.Page("seiten/test.py", title="Test")


pg = st.navigation(
    ["seiten/stg.py", "seiten/settings.py", "seiten/photo.py", "seiten/test.py"],
    expanded=False,
)
pg.run()


st.link_button(
    "Close",
    "https://login.schulportal.hessen.de/?url=aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8=&skin=sp&i=5120",
)


if st.checkbox("Session State"):
    st.write(st.session_state)

if st.button("Neurendern"):
    st.rerun()
