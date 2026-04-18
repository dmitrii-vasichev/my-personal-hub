from chunker import chunk_reply


def test_short_text_single_chunk():
    assert chunk_reply("hello") == ["hello"]


def test_long_text_split_on_paragraph():
    text = ("para a\n\n" + "x" * 4100) + "\n\npara c"
    chunks = chunk_reply(text, limit=4000)
    assert len(chunks) >= 2
    assert all(len(c) <= 4050 for c in chunks)  # allow fence wrap padding


def test_code_fence_balanced_across_chunks():
    body = "```\n" + ("line\n" * 1000) + "```"
    chunks = chunk_reply(body, limit=4000)
    assert len(chunks) >= 2
    for c in chunks:
        assert c.count("```") % 2 == 0
