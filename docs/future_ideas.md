This file contains future ideas and features for ScribeX.

Remaining Tasks to fix

0 - [x] Update to expo sdk 57 (COMPLETED)
1 - [x] autoscroll the notes when the user is dragging an element and goes out of visible screen bounds or reaches near the boundry (COMPLETED)
2 - [x] clear the element selection when the user clicks anywhere else in the screen (COMPLETED)
3 - [x] make the paragraph element the checkpoint inside the checklist group with H1, H2, Quote, and Text options (COMPLETED)
4 - make the note editor appear in different screen rather then home screen
4 - Adding an action tracking system and then Add undo and redo functionality to the editor for all the blocks . use 3 level metadata system for tracking actions - Tier 1: Note-Level Metadata (The Container) , 2 - Tier 2: Block-Level Metadata (The Elements), Tier 3: Asset Metadata (The Files) . Tier 1 metadata can be added in later stage after we complete the note editor part


Long term Ideas

1 - Use firebase for realtime database update and backup / cloud sync for the user data and use nextjs for AI API calls and host it on vercel for maintaining free hosting. use google drive api for storing media files on google drive and the firebase will only store the links of the media files



3 - Adding multi agent support if the user wants a specific agent to perform any task from a particular note or group notes . these multi agents will be also added using the help of the main agent i.e the main AI Assistant that has all the context of the user and the system so they can perform tasks but with limited access to the context either provided by the main agent when creating them or either by the user 