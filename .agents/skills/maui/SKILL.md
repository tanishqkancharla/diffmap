---
name: maui
description: Conventions for installing, updating, and consuming the Maui design system. Use when changing the Maui package or building UI with Maui tokens, components, patterns, or purse-styles.
---

# Maui

Read the reference for the work you are doing:

- When installing or updating the Maui package, read [installing_maui.md](references/installing_maui.md).
- When designing, implementing, or reviewing UI with Maui, read [design_conventions.md](references/design_conventions.md), then open every matching component, pattern, or app reference below.

## Foundation

| Need                                          | Reference                         |
| --------------------------------------------- | --------------------------------- |
| Tokens, `purse-styles`, motion, layout, theme | [tokens.md](references/tokens.md) |

## Components

| Page                    | Reference                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Avatar                  | [avatar.md](references/components/avatar.md)                                                 |
| Badge                   | [badge.md](references/components/badge.md)                                                   |
| Buttons                 | [buttons.md](references/components/buttons.md) (`Button`, `Overlay`, `Dialog`)               |
| Tab bar                 | [tab-bar.md](references/components/tab-bar.md)                                               |
| Drawer                  | [drawer.md](references/components/drawer.md)                                                 |
| Prose                   | [prose.md](references/components/prose.md) (`Prose`, `H1`–`H4`, `P`, lists, `Label`, `Link`) |
| Editor / MarkdownEditor | [editor.md](references/components/editor.md) (optional TipTap peers; separate imports)       |
| Thinking                | [thinking.md](references/components/thinking.md)                                             |
| Crossfade               | [crossfade.md](references/components/crossfade.md)                                           |
| Loading screen          | [loading-screen.md](references/components/loading-screen.md)                                 |
| Text                    | [text.md](references/components/text.md)                                                     |
| Form controls           | [form-controls.md](references/components/form-controls.md)                                   |
| Select                  | [select.md](references/components/select.md)                                                 |
| List box                | [list-box.md](references/components/list-box.md)                                             |
| Table                   | [table.md](references/components/table.md)                                                   |
| Menu                    | [menu.md](references/components/menu.md)                                                     |
| Tooltip                 | [tooltip.md](references/components/tooltip.md)                                               |
| Layout utilities        | [layout-utilities.md](references/components/layout-utilities.md)                             |
| FuzzyString             | [fuzzy-string.md](references/components/fuzzy-string.md)                                     |
| Icons                   | [icons.md](references/components/icons.md)                                                   |
| Code                    | [code.md](references/components/code.md)                                                     |

## Patterns

| Page              | Role                                                               | Reference                                                        |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Inbox             | Mail thread list with unread dot, hover actions, selection         | [inbox.md](references/patterns/inbox.md)                         |
| Message list      | Thread of raised message cards (avatar + Prose body)               | [message-list.md](references/patterns/message-list.md)           |
| Assistant message | Streaming markdown reply (Streamdown + Maui prose + CodeBlock)     | [assistant-message.md](references/patterns/assistant-message.md) |
| Sidebar           | 240px nav: sections, active item, optional icon and trailing badge | [sidebar.md](references/patterns/sidebar.md)                     |

## Apps

| Page         | Role                                                               | Reference                                          |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------- |
| Calendar     | Three-pane schedule (mini month, week grid, event details)         | [calendar.md](references/apps/calendar.md)         |
| Email client | Two-pane inbox + reading pane                                      | [email-client.md](references/apps/email-client.md) |
| AI chat      | Mock streaming chat (MarkdownEditor + AssistantMessage + Thinking) | [ai-chat.md](references/apps/ai-chat.md)           |
