"use client";

export default function PortalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel empty" role="alert">
      <h2>This screen could not be shown</h2>
      <p>{error.message && !/digest/i.test(error.message) && error.message.length < 240 ? error.message : "Something went wrong while loading it. Your data is safe."}</p>
      <p style={{ marginTop: 14 }}><button className="btn primary" onClick={reset}>Try again</button></p>
    </div>
  );
}
