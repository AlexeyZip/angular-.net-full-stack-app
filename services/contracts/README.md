# Integration event contracts

Sample messages exchanged between `services/api` (producer, transactional outbox) and `services/notifications`
(consumer). Each file is a complete envelope as sent to `POST /internal/events`.

Both sides test against these files instead of sharing an assembly, so the services stay independently
deployable:

- producer: `services/api/tests/Shop.Api.UnitTests/EventContractTests.cs` checks that the serialized C# event has
  exactly the payload fields of the sample;
- consumer: `services/notifications/tests/Shop.Notifications.Tests` posts each sample and expects it to be handled.

Compatibility rules: adding a payload field is compatible (consumers ignore unknown fields); removing, renaming or
changing the meaning of a field requires a new type with the next version suffix (`order.placed.v2`) published
alongside the old one until every consumer has migrated.
