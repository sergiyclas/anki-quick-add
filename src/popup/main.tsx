import { render } from "preact";
import "../ui/base.css";
import "./popup.css";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
