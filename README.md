# workclock

Fast, correct business-time arithmetic (working hours, SLAs, shifts) for Rust,
Python and JavaScript — a maintained, drop-in replacement for
[businesstimedelta](https://github.com/seppemans/businesstimedelta).

> **Status:** in development. No release has been published yet.

## Install

```sh
cargo add workclock
pip install workclock
uv add workclock
npm i workclock
```

## Use cases

- Support-ticket SLAs: when is a ticket due, and how much of its SLA has elapsed?
- Payroll and overtime: how many hours of a shift fell inside contracted time?
- Staff rosters, including overnight shifts.
- Delivery ETAs that only count operating hours.

## Prior art & credits

workclock builds on [businesstimedelta](https://github.com/seppemans/businesstimedelta)
by Sebastiaan Boer, released under the MIT license. Its last release, 1.0.1,
was in September 2019, and issues
[#3](https://github.com/seppemans/businesstimedelta/issues/3),
[#8](https://github.com/seppemans/businesstimedelta/issues/8),
[#9](https://github.com/seppemans/businesstimedelta/issues/9),
[#10](https://github.com/seppemans/businesstimedelta/issues/10) and
[#12](https://github.com/seppemans/businesstimedelta/issues/12) remain open.
workclock ports its test suite and offers its API as `workclock.compat`. The
original copyright notice is kept in [NOTICE](NOTICE).

## License

[MIT](LICENSE)
