"""Entry point: python -m botva_autoclicker."""

from .gui import BotvaGUI


def main() -> None:
    app = BotvaGUI()
    app.run()


if __name__ == "__main__":
    main()
