import { render } from "preact";
import "../ui/base.css";
import "./editor.css";
import { bootPage } from "../ui/boot";
import { App } from "./App";

void bootPage(() => render(<App />, document.getElementById("app")!));
