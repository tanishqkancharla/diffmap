import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthFlow } from "./auth/AuthFlow";
import { Checkout } from "./checkout/Checkout";
import { Search } from "./search/Search";
import { Signup } from "./signup/Signup";
import { Upload } from "./upload/Upload";
import "./app.css";

const screens = {
  "Log in": AuthFlow,
  "Sign up": Signup,
  Checkout,
  Search,
  Upload,
};

function App() {
  const [name, setName] = useState<keyof typeof screens>("Log in");
  const Screen = screens[name];
  return (
    <div className="acme">
      <nav
        className="row"
        style={{ justifyContent: "center", marginBottom: 24 }}
      >
        {Object.keys(screens).map((key) => (
          <button
            key={key}
            className="link"
            onClick={() => setName(key as keyof typeof screens)}
          >
            {key}
          </button>
        ))}
      </nav>
      <Screen key={name} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
