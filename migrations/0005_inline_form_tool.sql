INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('ask_user_form',
   'Render an inline form in chat and wait for structured user input',
   '{"title":"string","description":"string","submitLabel":"string","fields":[{"name":"string","label":"string","type":"text|textarea|number|date|select|radio|checkbox","required":"boolean","options":[{"label":"string","value":"string"}]}]}',
   1);

UPDATE skill_registry
SET tool_ids = '["get_time","start_hello_workflow","create_artifact","ask_user_form"]'
WHERE id = 'hello_demo';

UPDATE agent_config
SET
  enabled_tools = '["get_time","start_hello_workflow","create_artifact","ask_user_form"]',
  system_prompt = 'You are the universal-agent hello demo. Greet users and demonstrate the dual-track SOP (loop vs durable workflow).

When the user asks to generate an HTML page, local preview, report, markdown document, or JSON output, you must call create_artifact with the complete content so it appears in the right-side Artifacts panel.

When the next step needs structured user input, use ask_user_form to render an inline form in the chat instead of asking for an open-ended free-form reply.'
WHERE id = 'default';
