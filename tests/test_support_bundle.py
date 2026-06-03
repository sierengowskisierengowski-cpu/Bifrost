import tarfile

from bifrost.support_bundle import build_support_bundle


def test_build_support_bundle_writes_tarball(tmp_path):
    bundle = build_support_bundle(tmp_path)
    assert bundle.exists()
    assert bundle.suffixes[-2:] == [".tar", ".gz"]
    with tarfile.open(bundle, "r:gz") as tar:
        names = tar.getnames()
    assert "diagnostics.json" in names
