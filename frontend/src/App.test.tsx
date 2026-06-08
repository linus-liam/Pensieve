import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App reflection flow", () => {
  it("opens on the capture page", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Pensieve" })).toBeInTheDocument();
    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open memories" })).toBeInTheDocument();
  });

  it("shows the memories timeline", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open memories" }));

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("That's all for now. Take a breath.")).toBeInTheDocument();
  });

  it("confirms when a memory is saved", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("What's on your mind?"), "A quiet thought for later.");
    await user.click(screen.getAllByRole("button", { name: "Save memory" })[0]);

    expect(screen.getByText("Saved to your memories")).toBeInTheDocument();
  });
});
