# Milestone 3 Revision 3: owner's notes (verbatim, 22 Nov 2026)

> Internal. Nothing here may be imported into or rendered by the player-facing application.

1. Right info box should have a handle so users can click and drag the box larger or smaller
2. The aircraft unit markers are still messed up. Their marker shows up as the nato symbol, rather than a info card with the nato symbol inset(like every other unit). make this consistent
3. Lets add some music to the game, you can find more details in /Users/c00lc4t95/workplace/spanish-diplomacy-project/music-attempt-2/supermix_v2_out . We should also add some SFX. Look for some "open source" sound packs, I think we have some notes about sfx in the project directory, but actions should have a sound, especially recruiting, building, and creating orders. Sending aircraft on missions should play a little aircraft noise. Ending turn should play a dramatic 2 second noise. Sending armies to re-inforce should play a marching sound. Sending armies via rail should play a train whistle and rail noise. sending armies by truck should play a diesel noise. Users should be able to independently control SFX volume and Music Volume and combined game volume. Lets plan more about SFX, please research good game design for how to balance noises to make sure that they aren't stacked, or play with weird artifacts. or that we add too many noises that users are annoyed.
3.a) As the size of our game gets bigger, lets make sure we're optimizing player's bandwidth, streaming where needed, compressing where possible, etc. This may be apart of the build process, as well as the infra setup.
4. Recruit page should show unit special effects, and handle when the text over flows.
5. Battle results, I want a balance sheet, that shows all the effects and bonuses that went into that fight, the final modifier sum, and then the final result compared to the modifier sum and die roll.
6. Troop costs seem off. 1/ Units should have ongoing man-power upkeep costs. 2/ The balance between security forces and Armies seem off, equal costs but less attack. 3/ I won the game not building any buildings and only training as many militia as I could.  We should increase militia upkeep costs to make this strategy non-tennable. Lets iterate on Troop and Buildings Costs and benefits
7. Mine upgrades take 11 turns to pay off and industry takes 12 turns; if games only last <10turns, these aren't worth it. Lets see if we can balance the realism against gameplay to make the economy more integral
8. Invasion Plans, the "enemy defender" view takes up the entire modal making it useless, lets make sure that the majority of that view is still the selection screen of all the reachable armies. And scrolling to the top shows the odds and whatnot
9. In the top left near the turn counter, we should show the total number of casualties from all sides.
10. If a player is 1pt away from winning, the AI should be more aggressive towards preventing it
11. Lets remove the "Popular Resistence" bonus for the republic
12. Overall I think we have the right resources, the right incomes(farms and industry) and the right expenses(recruiting, building, etc.), but I think we need to add upkeep, and we need to adjust the values.

Go ahead and start researching the rev 3 plan, I want an artifact at the end. I imagine the balance part will be hard, so try to research some provisional tenets that will help guide us balance the economy game, we'll probably want some widgets for this. I also want rev3 to be a code pruning path as well, looking at the jsons and the code, it seems like we may be accumulating some cruft in the codebase that we no longer need, lets make sure we remove that.

I want you to go a littler deeper on the research and artifact generation, keep it under 50 questions, 20-30 is ideal, Keep the cost ~1.5M tokens
