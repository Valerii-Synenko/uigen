import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const SUCCESS = { success: true as const };
const FAILURE = { success: false as const, error: "Invalid credentials" };

const ANON_PROJECT = { id: "anon-project-1" } as any;
const EXISTING_PROJECT = { id: "existing-project-1" } as any;
const NEW_PROJECT = { id: "new-project-1" } as any;

const ANON_MESSAGES = [{ role: "user", content: "hello" }];
const ANON_FS_DATA = { "/App.jsx": { type: "file", content: "export default () => <div/>" } };

beforeEach(() => {
  vi.clearAllMocks();
  // Safe defaults — most tests override only what they need
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(NEW_PROJECT);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  test("isLoading starts false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// signIn — happy paths
// ---------------------------------------------------------------------------

describe("signIn — anon work with messages", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
    mockCreateProject.mockResolvedValue(ANON_PROJECT);
  });

  test("creates a project from anonymous work", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: ANON_MESSAGES, data: ANON_FS_DATA })
    );
  });

  test("project name includes current time string", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    const [call] = mockCreateProject.mock.calls;
    expect(call[0].name).toMatch(/^Design from /);
  });

  test("clears anonymous work after project creation", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  test("navigates to the new project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockPush).toHaveBeenCalledWith(`/${ANON_PROJECT.id}`);
  });

  test("does not call getProjects", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("returns success result", async () => {
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => { returnValue = await result.current.signIn("a@a.com", "password1"); });

    expect(returnValue).toEqual(SUCCESS);
  });
});

describe("signIn — no anon work, existing projects", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([EXISTING_PROJECT]);
  });

  test("navigates to the most recent existing project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECT.id}`);
  });

  test("does not create a new project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("navigates to the first (most recent) project when multiple exist", async () => {
    mockGetProjects.mockResolvedValue([
      { id: "project-newest" } as any,
      { id: "project-older" } as any,
    ]);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockPush).toHaveBeenCalledWith("/project-newest");
  });
});

describe("signIn — no anon work, no existing projects", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue(NEW_PROJECT);
  });

  test("creates a new empty project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
  });

  test("new project name matches New Design pattern", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    const [call] = mockCreateProject.mock.calls;
    expect(call[0].name).toMatch(/^New Design #\d+$/);
  });

  test("navigates to the new project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });
});

// ---------------------------------------------------------------------------
// signIn — failure / error paths
// ---------------------------------------------------------------------------

describe("signIn — action failure", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue(FAILURE);
  });

  test("returns the failure result", async () => {
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => { returnValue = await result.current.signIn("a@a.com", "wrong"); });

    expect(returnValue).toEqual(FAILURE);
  });

  test("does not navigate", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "wrong"); });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("does not create a project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "wrong"); });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// signIn — loading state
// ---------------------------------------------------------------------------

describe("signIn — loading state", () => {
  test("resets isLoading to false after successful sign in", async () => {
    mockSignInAction.mockResolvedValue(SUCCESS);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after failed sign in", async () => {
    mockSignInAction.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "wrong"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false when action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@a.com", "password1").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signIn — forwards credentials correctly
// ---------------------------------------------------------------------------

describe("signIn — credential forwarding", () => {
  test("passes email and password to signIn action", async () => {
    mockSignInAction.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("user@example.com", "mypassword"); });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
  });
});

// ---------------------------------------------------------------------------
// Edge cases — anon work with empty messages
// ---------------------------------------------------------------------------

describe("signIn — anon work with empty messages array", () => {
  test("falls through to checking existing projects", async () => {
    mockSignInAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([EXISTING_PROJECT]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@a.com", "password1"); });

    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECT.id}`);
  });
});

// ---------------------------------------------------------------------------
// signUp — mirrors signIn behaviour
// ---------------------------------------------------------------------------

describe("signUp — anon work with messages", () => {
  beforeEach(() => {
    mockSignUpAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
    mockCreateProject.mockResolvedValue(ANON_PROJECT);
  });

  test("creates a project from anonymous work and navigates", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@a.com", "password1"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: ANON_MESSAGES, data: ANON_FS_DATA })
    );
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(`/${ANON_PROJECT.id}`);
  });

  test("returns success result", async () => {
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => { returnValue = await result.current.signUp("a@a.com", "password1"); });

    expect(returnValue).toEqual(SUCCESS);
  });
});

describe("signUp — action failure", () => {
  test("returns failure result without navigating", async () => {
    mockSignUpAction.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => { returnValue = await result.current.signUp("a@a.com", "short"); });

    expect(returnValue).toEqual(FAILURE);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("signUp — loading state", () => {
  test("resets isLoading to false after successful sign up", async () => {
    mockSignUpAction.mockResolvedValue(SUCCESS);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@a.com", "password1"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after failed sign up", async () => {
    mockSignUpAction.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@a.com", "short"); });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false when action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@a.com", "password1").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("signUp — credential forwarding", () => {
  test("passes email and password to signUp action", async () => {
    mockSignUpAction.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "newpassword"); });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "newpassword");
  });
});

describe("signUp — no anon work, no existing projects", () => {
  test("creates a new empty project and navigates", async () => {
    mockSignUpAction.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue(NEW_PROJECT);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@a.com", "password1"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });
});