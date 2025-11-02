import streamlit as st
from pathlib import Path

def load_css_files(css_paths):
    css_combined = ""
    for path in css_paths:
        # Pfad relativ zu deinem Projektverzeichnis
        p = Path(path)
        if p.exists():
            css_combined += p.read_text(encoding="utf-8") + "\n"
        else:
            st.warning(f"CSS-Datei nicht gefunden: {path}")
    return css_combined

#Liste der CSS-Pfade
css_files = [
    "css/bootstrap.min.css",
    "css/responsive-text.css",
    "css/own.css",
    "import/fontawesome/css/all.min.css",
    "import/fontawesome/css/solid.min.css",
    "import/fontawesome/css/v4-shims.min.css",
    "css/theme.css",
    "css/jquery-ui.min.css",
    "css/bootstrap.submenue.css",
    "css/schulnavbar/5120/5cbd8f8a3efde40b90c1877fd07b47dd.css",
    "module/nachrichten/css/conversation.css",
    "module/nachrichten/css/read.css",
    "css/test.css",
]

css_content = load_css_files(css_files)

print(css_content)

html_fragment = f"""
<!DOCTYPE html>
<html lang="de">

<head>
    <title>
        Nachrichten - Unterhaltung
        - Schulportal Hessen - Pädagogische Organisation</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Schulportal Hessen">
    <link rel="manifest" href="manifests/5120/manifest.json">
    <link rel="icon" type="image/png" sizes="16x16" href="/img/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32x32.png">
    <style>
    {css_content}
    </style>
</head>

<body>
<div class="box1"></div>
    <div class="allButFooter">
        <div class="hidden-print">
            <nav class="navbar navbar-default visible-lg visible-md navbar-custom navbar-first">
                <div class="container">
                    <div class="navbar-header">
                        <a class="navbar-brand" href="index.php">
                            <img src="img/logo-schulportal-topbar.svg" title="Schulportal Hessen"
                                style="position: relative; left: -13px; top: -16px" width="300" />
                        </a>
                    </div>
                </div>
            </nav>
        </div>
        <div class="hidden-print" style="background-color: #ffffff;" id="headlogo">
            <div class="container visible-lg visible-md">
                <div class="masthead">
                    <div class="row headlogo">
                        <div class="col-md-12">
                            <img src="img/schullogo/5120/447966e8796291c291a2fd333b9fc323.png"
                                class="hidden-phone img-responsive pull-left"
                                style="padding-right: 10px; display: inline;vertical-align: middle;" />
                            <div style="padding-top: 15px;">
                                <p class="headtitle">
                                    Rheingauschule <small>Geisenheim</small>
                                    <span id="institutionsid" data-bezeichnung="Rheingauschule"
                                        class="hidden">5120</span>
                                </p>
                                <div class="hidden-phone tiny">"Schulportal Hessen - Pädagogische Organisation"</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="navbar navbar-default navbar-custom navbar-last hidden-print" role="navigation"
            data-toggle="sticky-onscroll">
            <div class="container">
                <div class="navbar-header visible-sm visible-xs">
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="index.php">Rheingauschule </a>
                </div>
                <div class="navbar-collapse collapse">
                    <ul class="nav navbar-nav" id="menueband">
                        <li>
                            <a href="index.php" data-wx="no" title="Startseite">
                                <i class="fa fa-home fa-fw" aria-hidden="true"></i>
                                Start

                            </a>
                        </li>
                        <li class="dropdown">
                            <a aria-expanded="false" role="button" data-toggle="dropdown" class="dropdown-toggle"
                                href="#" id="topapps">
                                <span class="fa fa-bars"></span>
                                Apps
                                <span class="caret"></span>
                            </a>
                            <ul role="menu" class="dropdown-menu">
                                <li>
                                    <a href="#">
                                        <i class="fa fa-spinner fa-spin fa-fw"></i>
                                        Lade ...
                                    </a>
                                </li>
                            </ul>
                        </li>
                        <li class="dropdown" id="toolmenue">
                            <a aria-expanded="false" role="button" data-toggle="dropdown" class="dropdown-toggle"
                                href="#"
                                style="background: radial-gradient(rgba(255,255,255,0.5) 10%, rgba(0,0,0,0) 70%);">
                                <span class="fas fa-mail-bulk"></span>
                                Nachrichten
                                <span class="caret"></span>
                            </a>
                            <ul role="menu" class="dropdown-menu">
                                <li>
                                    <a href="nachrichten.php">
                                        <span class="fa fa-search fa-fw"></span>
                                        Posteingang

                                    </a>
                                </li>
                                <li>
                                    <a href="nachrichten.php?to[]=null">
                                        <span class="fa fa-pencil fa-fw"></span>
                                        Neue Unterhaltung

                                    </a>
                                </li>
                                <li>
                                    <a href="nachrichten.php?a=user-einstellungen">
                                        <span class="fa fa-user-cog fa-fw"></span>
                                        Einstellungen

                                    </a>
                                </li>
                                <li role="separator" class="divider"></li>
                                <li>
                                    <a href="https://support.schulportal.hessen.de/knowledgebase.php?category=112"
                                        target="_blank">
                                        <span class="fa fa-question-circle fa-fw"></span>
                                        FAQ

                                    </a>
                                </li>
                                <li>
                                    <a href="https://info.schulportal.hessen.de/das-sph/sph-paedorg/nachrichten/"
                                        target="_blank">
                                        <span class="fa fa-info-circle fa-fw"></span>
                                        Weitere Informationen

                                    </a>
                                </li>
                            </ul>
                        </li>
                    </ul>
                    <ul class="nav navbar-nav navbar-right">
                        <li class="dropdown">
                            <a aria-expanded="false" role="button" data-toggle="dropdown" class="dropdown-toggle"
                                href="#">
                                <i class="fa-solid fa-child"></i>
                                Winderl, Gregor (Eb)
                                <span class="caret"></span>
                            </a>
                            <ul role="menu" class="dropdown-menu">
                                <li>
                                    <a href="benutzerverwaltung.php?a=userChangePassword" data-wx="no">
                                        <span class="fa fa-key fa-fw"></span>
                                        Passwort ändern

                                    </a>
                                </li>
                                <li>
                                    <a href="benutzerverwaltung.php?a=userMail" data-wx="no">
                                        <span class="fa fa-at fa-fw"></span>
                                        E-Mail & Benachrichtigungen

                                    </a>
                                </li>
                                <li>
                                    <a href="benutzerverwaltung.php?a=userFoto" data-wx="no">
                                        <span class="fa fa-image fa-fw"></span>
                                        Foto

                                    </a>
                                </li>
                                <li role="separator" class="divider"></li>
                                <li>
                                    <a href="benutzerverwaltung.php?a=userData" data-wx="no">
                                        <span class="fa fa-list fa-fw"></span>
                                        Benutzerdaten

                                    </a>
                                </li>
                                <li role="separator" class="divider"></li>
                                <li>
                                    <a href="benutzerverwaltung.php?a=userAutologins" data-wx="no">
                                        <span class="fa fa-sign-in fa-fw"></span>
                                        Automatische Anmeldungen

                                    </a>
                                </li>
                            </ul>
                        </li>
                        <li class="dropdown">
                            <a aria-expanded="false" role="button" data-toggle="dropdown" class="dropdown-toggle"
                                href="#">
                                <span class="fa-solid fa-headset"></span>
                                Support
                                <span class="caret"></span>
                            </a>
                            <ul role="menu" class="dropdown-menu">
                                <li>
                                    <a href="lanis-support.php" data-click="support" target="_blank">
                                        <span class="fa-solid fa-headset"></span>
                                        Support

                                    </a>
                                </li>
                                <li>
                                    <a href="https://rechtstexte.schulportal.hessen.de/dse.php">
                                        <span class="glyphicon glyphicon-eye-open"></span>
                                        Datenschutz

                                    </a>
                                </li>
                                <li>
                                    <a href="https://support.schulportal.hessen.de/knowledgebase.php?category=45"
                                        target="_blank">
                                        <span class="glyphicon glyphicon-question-sign"></span>
                                        Hilfe/FAQ

                                    </a>
                                </li>
                                <li class="divider"></li>
                                <li>
                                    <a href="verwaltung.php?a=impressum" target="_blank">
                                        <span class="glyphicon glyphicon-info-sign"></span>
                                        Impressum

                                    </a>
                                </li>
                            </ul>
                        </li>
                        <li>
                            <a href="index.php?logout=all" data-wx="no"
                                title="Abmeldung aus allen angebundenen Systemen">
                                <span class="fa fa-power-off fw"></span>
                                Logout

                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="container">
            <div class="row clearfix hidden-print">
                <div class="col-md-12 column logoutTimer"></div>
            </div>
            <div id="content" style=background-color: lightblue;
    color: lightblue;>
                <div style="display: flex; align-items: center;">
                    <h1 data-user="368305" data-privateansweronly="nein"
                        data-msg="4ffad0d6fb3ffe376af7e769312a5337-60a72042-2c00-4a7b-a03e-bcb7cdf24573">Unterhaltung
                    </h1>
                    <div style="margin-left: auto;"></div>
                </div>
                <div class="row" id="load">
                    <div class="alert alert-info">
                        <span class="fa fa-spinner fa-spin"></span>
                        Lade Unterhaltung

                    </div>
                </div>
                <div id="EmpfaengerListe" class="alert alert-info" role="alert" hidden></div>
                <div class="dropdown hidden-print pull-right" id="dropdownMenu-na"
                    style="position: sticky; top: 160px; z-index: 1001;">
                    <a href="#" id="dropdownBtn-na" class="btn btn-default dropdown-toggle" data-toggle="dropdown"
                        title="Menü">
                        <span class="fa fa-ellipsis-v"></span>
                    </a>
                    <ul id="ddmItems" class="dropdown-menu pull-right na-dropdown">
                        <li>
                            <span id="deleteBtn" title="Nachricht ausblenden">
                                <span class="btn btn-danger">
                                    <i class="fa fa-eye-slash fa-fw"></i>
                                </span>
                            </span>
                        <li>
                            <span id="printBtn" title="drucken">
                                <span class="btn btn-default">
                                    <i class="fa fa-print fa-fw"></i>
                                </span>
                            </span>
                        <li>
                            <span onclick="window.location.href = 'nachrichten.php';" title="Posteingang">
                                <span class="btn btn-primary">
                                    <i class="fa fa-mail-bulk fa-fw"></i>
                                </span>
                            </span>
                    </ul>
                </div>
                <div class="chat">
                    <div class="chat-history">
                        <ul class="chat-ul" style="padding-inline-start: 4px;"></ul>
                    </div>
                </div>
                <template id="messageOwn">
                    <li class="clearfix">
                        <div class="message-data align-right">
                            <span class="message-data-time"></span>
                            <span class="message-data-name">You</span>
                            <i class="fa fa-circle me"></i>
                        </div>
                        <div class="msgInfo float-right hidden" style="page-break-inside:avoid">ccsdcscsc</div>
                        <div class="message me-message float-right" style="page-break-inside:avoid"></div>
                    </li>
                </template>
                <template id="message">
                    <li class="clearfix" style="page-break-inside:avoid">
                        <div class="message-data">
                            <i class="usersymbol fa"></i>
                            <span class="message-data-name"></span>
                            <span class="btn btn-link absender" title="nur an diese Person antworten">
                                <span class="fa fa-reply absender"></span>
                            </span>
                            <span class="message-data-time"></span>
                            <span class="message-new label label-danger">neu</span>
                            <span class="privateAnswer align-right" style="color:red; font-weight: bold"></span>
                        </div>
                        <div class="msgInfo hidden" style="page-break-inside:avoid"></div>
                        <div class="message you-message"></div>
                    </li>
                </template>
                <template id="answer" style="position:fixed">
                    <div class="row "></div>
                    <form id="answerForm" method="post" action="nachrichten.php" class="form-horizontal d-print-none"
                        accept-charset="utf-8">
                        <div id="answerForm2">
                            <div class="col-md-12">
                                <div class="row hidden-print">
                                    <div class="col col-lg-3">
                                        <input id="userID" type="hidden" value="">
                                    </div>
                                    <div class="col col-lg-6"></div>
                                    <div class="row">
                                        <div class="col-md-12">
                                            <div class="col-md-10" id="msgBoxHeader" data-uid=""
                                                style="padding-bottom: 5px;">
                                                <span id="msgBoxHeaderText"></span>
                                                <span style="margin-left: 10px; margin-bottom: 5px;">
                                                    <span id="allBtn" class="btn btn-primary ">
                                                        <span class="fa fa-reply" style="margin-right: 4px;"></span>
                                                        Allen Antworten
                                                    </span>
                                                </span>
                                            </div>
                                            <div class="col-md-2" align="right">
                                                <label>
                                                    Text/Inhalt
                                                    <a href="https://support.schulportal.hessen.de/knowledgebase.php?article=664"
                                                        target="_blank">
                                                        <i style=" color: Dodgerblue;" class="fa fa-info-circle"></i>
                                                    </a>
                                                </label>
                                            </div>
                                            <input type="hidden" id="toId" name="toId" value="">
                                            <textarea id="MsgInput" class="form-control" rows="8"></textarea>
                                        </div>
                                        <div class="col-md-12" style="margin-top: 5px;">
                                            <button class="btn btn-primary send">
                                                <i class="fa fa-paper-plane"></i>
                                                Antwort senden
                                            </button>
                                            <a href="nachrichten.php" class="btn btn-default pull-right">
                                                <i class="fas fa-mail-bulk fa-fw"></i>
                                                Posteingang
                                            </a>
                                        </div>
                                    </div>
                                    <div class="col-md-12">
                                        <span class="text-info sended">
                                            <span class="fa fa-circle fa-spin"></span>
                                            sende ...
                                        </span>
                                        <span class="text-success saved">
                                            <span class="fa fa-check"></span>
                                            Nachricht gesendet!
                                        </span>
                                    </div>
                                </div>
                    </form>
                </template>
                <span class="hidden-print">
                    <br />
                    <br />
                </span>
            </div>
        </div>
    </div>
    <div class="hidden-print footer">
        <div class="row visible-lg visible-md">
            <div class="cold-md-12">
                <table width="100%">
                    <tr>
                        <td width="50%">
                            <a href="index.php">
                                <img src="img/logo-schulportal-footer.svg" width="160" height="29">
                            </a>
                        </td>
                        <td style="text-align: right;" width="50%">
                            <a href="https://rechtstexte.schulportal.hessen.de/dse.php">Datenschutz</a>
                            &nbsp;|&nbsp;<a href="verwaltung.php?a=impressum">Impressum</a>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        <div class="row visible-sm visible-xs">
            <div class="col-sm-12 col-xs-12" style="font-size: 8pt; text-align: center;">
                <a href="https://rechtstexte.schulportal.hessen.de/dse.php">Datenschutz</a>
                &nbsp;|&nbsp;<a href="verwaltung.php?a=impressum">Impressum</a>
            </div>
        </div>
    </div>
</body>
</html>
"""

st.html(html_fragment)

