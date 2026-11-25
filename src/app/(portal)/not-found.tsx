import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel empty">
      <h2>That page is not here</h2>
      <p>The candidate may have been deleted, or the address is not complete.</p>
      <p style={{ marginTop: 14 }}><Link className="btn primary" href="/search">Back to search</Link></p>
    </div>
  );
}
