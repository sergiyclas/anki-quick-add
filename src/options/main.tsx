import { render } from "preact";
import "../ui/base.css";
import "./options.css";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
