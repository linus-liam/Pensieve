import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabUpdateBanner } from "./LabUpdateBanner";
import { labUpdateReadyEvent } from "./lab";

describe("Pensieve Lab updates", () => {
  it("shows an explicit refresh action only after a new build is ready", () => {
    render(<MantineProvider><LabUpdateBanner /></MantineProvider>);
    expect(screen.queryByText("Pensieve Lab 有新版")).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event(labUpdateReadyEvent)));

    expect(screen.getByText("Pensieve Lab 有新版")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新到新版" })).toBeInTheDocument();
    expect(screen.getByText("刷新后立即使用；当前设备里的聊天不会被清除。")).toBeInTheDocument();
  });
});
