import streamlit as st

st.title("Hallo")


st.html("""<!DOCTYPE html>
<html lang="de">

<head>
    <title>
        Nachrichten - Unterhaltung - Schulportal Hessen - Pädagogische Organisation</title>
    <style>
        .box1 {
            position: fixed;
            left: 0%;
            top: 0%;
            width: 300px;
            height: 300px;
            background-color: lightblue;
        }
    </style>
</head>
        """)

st.html('<body> <div class="box1"></div> </body>')