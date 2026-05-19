import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import { tokens } from "../../tokens/colors";

describe("Composer", () => {
  it("keeps text when send fails", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(false);

    render(<Composer t={tokens.light} pending={false} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Write what's sitting with you…");
    await user.type(input, "Please keep this");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith("Please keep this");
    expect(input).toHaveValue("Please keep this");
  });

  it("clears text after a successful send", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(true);

    render(<Composer t={tokens.light} pending={false} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Write what's sitting with you…");
    await user.type(input, "This can clear");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(input).toHaveValue("");
  });
});
