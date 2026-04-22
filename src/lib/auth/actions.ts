"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(type: "error" | "message", message: string) {
  const params = new URLSearchParams({
    [type]: message,
  });

  redirect(`/login?${params.toString()}`);
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithMessage("error", "Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithMessage("error", "Email and password are required.");
  }

  const emailRedirectTo = new URL("/auth/confirm", getBaseUrl());
  emailRedirectTo.searchParams.set("next", "/");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirectTo.toString(),
    },
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  redirectWithMessage(
    "message",
    "Check your email to confirm the account, then sign in.",
  );
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login?message=Signed%20out.");
}
