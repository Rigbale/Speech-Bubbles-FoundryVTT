class PointerSettings extends FormApplication {
	static defaultSettings() {
		return {
			key: 89,    // Modify this value to modify the key used.
									// You need to insert a keycode, not the actual key!
									// Example codes: - CTRL = 17
									//                - ALT  = 18
									//                - C    = 67
			// Pointer options
			pointer: {       
					scale: 1,               // Scale relative to the grid_dim
					svg_name: "pointer.svg"     // The svg name
			},
			// Ping options
			ping: {     
					duration: 6,      // Sets the pings duration in seconds
					rotate:   true,      // Toggles Rotation
					rotate_speed: 6,     // Duration in seconds for one complete turn
					size_change:true,           // Toggles Size animation
					size_change_speed: 3,       // Speed for size change animation
																			// Time for one cycle in seconds
					size_change_amount: 0.125,   // The amount the size changes during one 
																			// animation cycle
					scale:    1,         // Scales the svg image. The factor is
															 // relative to the grid dimension.
					svg_use:  false,     // Toggles if default ping should be used or a
															 // given svg
					svg_name: "focus.svg" // SVG name. The file has to be located in the
															 // modules repository
															 // The SVG image will be centered on the 
															 // clicked point.
			}
		};
	}

	// static get defaultOptions() {
  //   return mergeObject(super.defaultOptions, {
  //     title: "Pointer Settings",
  //     id: "pointer-settings",
  //     template: "modules/pointer/pointer-settings.html",
  //     width: 660,
  //     height: "auto",
	// 		closeOnSubmit: false,
	// 		submitOnClose: true,
	// 		submitOnChange: true
  //   })
  // }

}

// Hooks.on('init', function() {
// 	game.settings.registerMenu('module', 'pointer-gm', {
// 		name: "Pointer Group Settings",
// 		label: "Pointer Settings",
// 		hint: "asd",
// 		icon: "fas fa-user-lock",
// 		type: PointerSettings,
// 		restricted: true
// 	})
// });