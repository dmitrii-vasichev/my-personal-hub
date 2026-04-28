from pathlib import Path


def test_root_railway_dockerfile_keeps_garth_cloudflare_override():
    """Root Railway build must include the Garmin Cloudflare/429 garth override."""
    repo_root = Path(__file__).resolve().parents[2]
    railway_toml = repo_root / "railway.toml"
    dockerfile_path = repo_root / "Dockerfile.railway"

    assert 'dockerfilePath = "Dockerfile.railway"' in railway_toml.read_text()

    dockerfile = dockerfile_path.read_text()
    assert "garth>=0.8.0" in dockerfile
