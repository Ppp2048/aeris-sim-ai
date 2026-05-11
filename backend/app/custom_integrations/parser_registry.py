from app.schemas import ParserInfo


class ParserRegistry:
    def __init__(self) -> None:
        self._parsers = [
            ParserInfo(
                name="sample_csv_parser",
                description="Parses local synthetic radar CSV rows with range, velocity, power, confidence, and label columns.",
                supported_extensions=[".csv"],
            )
        ]

    def list_parsers(self) -> list[ParserInfo]:
        return self._parsers


parser_registry = ParserRegistry()
