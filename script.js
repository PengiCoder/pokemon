document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const pokedexList = document.getElementById('pokedex-list');
    const loadingMessage = document.getElementById('loading-message');
    const searchInput = document.getElementById('search-input');
    const typeCheckboxesContainer = document.getElementById('type-checkboxes');
    const clearFiltersButton = document.getElementById('clear-filters');
    const loadingTypesSpan = document.querySelector('.loading-types');
    const modal = document.getElementById('pokemon-modal');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // --- Constants ---
    const POKEMON_COUNT = 1025; // Gen 1-9 as of writing
    const POKEAPI_URL = 'https://pokeapi.co/api/v2/';
    const MAX_STAT_VALUE = 255; // For stat bar scaling

    // --- State ---
    let allPokemonData = []; // Stores basic list data {id, name, sprite, types}
    let allTypes = new Set(); // Stores unique types found

    // --- Dark Mode Logic ---
    const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>'; // Sun icon for dark mode
            darkModeToggle.title = "Switch to Light Mode"; // Update title
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.remove('dark-mode');
            darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>'; // Moon icon for light mode
            darkModeToggle.title = "Switch to Dark Mode"; // Update title
            localStorage.setItem('theme', 'light');
        }
    }

    // Apply initial theme based on saved preference or system setting
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (userPrefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light'); // Default to light
    }

    // Toggle theme on button click
    darkModeToggle.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });


    // --- Initial Data Fetching (Basic List) ---
    async function fetchBasicPokemonData(id) {
        try {
            const response = await fetch(`${POKEAPI_URL}pokemon/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            // Extract only necessary info for the list view
            const pokemon = {
                id: data.id,
                name: data.name,
                sprite: data.sprites?.front_default || 'placeholder.png',
                types: data.types.map(typeInfo => typeInfo.type.name)
            };
            // Collect unique types for filtering
            pokemon.types.forEach(type => allTypes.add(type));
            return pokemon;
        } catch (error) {
            console.error(`Could not fetch basic data for Pokémon ID ${id}:`, error);
            return null; // Gracefully handle failure for single Pokémon
        }
    }

    async function fetchAllPokemon() {
        console.log('Starting basic Pokémon fetch...');
        loadingMessage.style.display = 'block'; // Show loading message
        const pokemonPromises = [];
        for (let i = 1; i <= POKEMON_COUNT; i++) {
            pokemonPromises.push(fetchBasicPokemonData(i));
        }

        // Wait for all basic fetches, continue even if some fail
        const results = await Promise.allSettled(pokemonPromises);

        // Filter out failed requests and map to the fulfilled values
        allPokemonData = results
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);

        console.log(`Fetched basic data for ${allPokemonData.length} Pokémon.`);
        loadingMessage.style.display = 'none'; // Hide loading message

        populateTypeFilters(); // Create type filter checkboxes
        displayPokemon(allPokemonData); // Display the initial list
    }

    // --- Minimal Data Fetch (for Evolution Sprites) ---
    // Fetches only ID, name, and default sprite - much lighter than full data
    async function fetchMinimalPokemonData(idOrName) {
         try {
            const response = await fetch(`${POKEAPI_URL}pokemon/${idOrName.toString().toLowerCase()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return { // Return only what's needed for evo display
                id: data.id,
                name: data.name,
                sprite: data.sprites?.front_default || 'placeholder.png'
            };
        } catch (error) {
            console.error(`Could not fetch minimal data for ${idOrName}:`, error);
            // Provide fallback data if fetch fails, using the original ID/Name
            const nameFallback = typeof idOrName === 'string' ? idOrName : `ID ${idOrName}`;
            return { id: idOrName, name: nameFallback, sprite: 'placeholder.png' };
        }
    }


    // --- Display Logic (List View) ---
    function createPokemonCard(pokemon) {
        const card = document.createElement('div');
        card.classList.add('pokemon-card');
        card.dataset.id = pokemon.id; // Store ID to fetch details later

        const sprite = document.createElement('img');
        sprite.src = pokemon.sprite;
        sprite.alt = pokemon.name;
        sprite.onerror = () => { sprite.src = 'placeholder.png'; sprite.alt = 'Image not found'; }; // Fallback image

        const idDiv = document.createElement('div');
        idDiv.classList.add('pokemon-id');
        idDiv.textContent = `#${pokemon.id.toString().padStart(4, '0')}`; // Pad ID (e.g., #0001)

        const nameDiv = document.createElement('div');
        nameDiv.classList.add('pokemon-name');
        nameDiv.textContent = pokemon.name;

        const typesContainer = document.createElement('div');
        typesContainer.classList.add('pokemon-types');
        pokemon.types.forEach(type => {
            const typeBadge = document.createElement('span');
            typeBadge.classList.add('type-badge', `type-${type}`);
            typeBadge.textContent = type;
            typesContainer.appendChild(typeBadge);
        });

        card.appendChild(sprite);
        card.appendChild(idDiv);
        card.appendChild(nameDiv);
        card.appendChild(typesContainer);

        // Add click listener to open the details modal
        card.addEventListener('click', () => showPokemonDetails(pokemon.id));

        return card;
    }

    function displayPokemon(pokemonArray) {
        pokedexList.innerHTML = ''; // Clear previous list
        if (pokemonArray.length === 0) {
            // Show message if no Pokémon match filters
            pokedexList.innerHTML = '<p class="no-results">No Pokémon match your criteria.</p>';
            return;
        }
        // Create and append a card for each Pokémon in the filtered array
        pokemonArray.forEach(pokemon => {
            if (pokemon) { // Ensure data exists
                 pokedexList.appendChild(createPokemonCard(pokemon));
            }
        });
    }

    // --- Filtering Logic ---
    function populateTypeFilters() {
        if (loadingTypesSpan) loadingTypesSpan.style.display = 'none'; // Hide "Loading types..." text
        const sortedTypes = Array.from(allTypes).sort(); // Sort types alphabetically

        typeCheckboxesContainer.innerHTML = ''; // Clear any existing checkboxes

        // Create a checkbox for each unique type
        sortedTypes.forEach(type => {
            const label = document.createElement('label');
            label.classList.add('type-checkbox-label');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = type;
            checkbox.classList.add('type-checkbox');
            // Re-apply filters whenever a checkbox changes state
            checkbox.addEventListener('change', applyFilters);

            // Wrap text in a span for better styling control (e.g., bold on check)
            const textSpan = document.createElement('span');
            textSpan.textContent = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize

            label.appendChild(checkbox);
            label.appendChild(textSpan);
            typeCheckboxesContainer.appendChild(label);
        });
    }

    function getSelectedTypes() {
        // Get the values of all checked type checkboxes
        const selectedCheckboxes = typeCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(selectedCheckboxes).map(cb => cb.value);
    }

     function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim(); // Get search term
        const selectedTypes = getSelectedTypes(); // Get selected types

        let filteredPokemon = allPokemonData; // Start with all Pokémon

        // Apply type filter: Pokémon must have ALL selected types
        if (selectedTypes.length > 0) {
            filteredPokemon = filteredPokemon.filter(pokemon =>
                pokemon && selectedTypes.every(type => pokemon.types.includes(type))
            );
        }

        // Apply search filter: Pokémon name must include the search term
        if (searchTerm) {
            filteredPokemon = filteredPokemon.filter(pokemon =>
               pokemon && pokemon.name.toLowerCase().includes(searchTerm)
            );
        }

        displayPokemon(filteredPokemon); // Update the displayed list
    }

    function clearTypeFilters() {
         // Uncheck all type checkboxes
         const checkboxes = typeCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
         checkboxes.forEach(cb => cb.checked = false);
         applyFilters(); // Re-apply filters
    }


    // --- Modal Logic & Detailed Fetch ---

    // Fetches the full data object for a single Pokémon ID
    async function fetchDetailedPokemonData(id) {
        try {
            const response = await fetch(`${POKEAPI_URL}pokemon/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Could not fetch detailed data for Pokémon ID ${id}:`, error);
            return null; // Return null on failure
        }
    }

    // Fetches the species data, then the evolution chain data from the species data
    async function fetchEvolutionChainData(speciesUrl) {
        try {
            // 1. Fetch Species Data
            const speciesResponse = await fetch(speciesUrl);
            if (!speciesResponse.ok) throw new Error(`Species fetch error! Status: ${speciesResponse.status}`);
            const speciesData = await speciesResponse.json();

            // 2. Check for and Fetch Evolution Chain Data
            if (!speciesData.evolution_chain?.url) {
                 console.warn(`No evolution chain URL found for ${speciesData.name}`);
                 return null;
            }
            const evolutionResponse = await fetch(speciesData.evolution_chain.url);
            if (!evolutionResponse.ok) throw new Error(`Evolution chain fetch error! Status: ${evolutionResponse.status}`);
            const evolutionData = await evolutionResponse.json();
            return evolutionData.chain; // Return the starting node
        } catch (error) {
            console.error(`Could not fetch evolution data for ${speciesUrl}:`, error);
            return null; // Return null on failure
        }
    }

     // Recursively parses the evolution chain data into a flat array including NAME and ID
     function parseEvolutionChain(chainData) {
        const evolutionPath = [];
        let currentStage = chainData;
        while (currentStage) {
            const speciesUrlParts = currentStage.species.url.split('/');
            // Extract the ID from the end of the species URL (robust way)
            const speciesId = speciesUrlParts.filter(part => part !== '').pop();

            if (speciesId) { // Ensure we got an ID
                evolutionPath.push({
                    name: currentStage.species.name,
                    id: speciesId // Store the ID
                });
            } else {
                console.warn("Could not extract ID for species:", currentStage.species.name);
            }

            // Move to the next stage (simplified for linear/first branch)
            if (currentStage.evolves_to && currentStage.evolves_to.length > 0) {
                currentStage = currentStage.evolves_to[0];
            } else {
                currentStage = null; // End of this path
            }
        }
        return evolutionPath; // Return array: [{name: 'pichu', id: '172'}, {name: 'pikachu', id: '25'}, ...]
    }

    // Generates the HTML string for the evolution chain, now including images
    function createEvolutionHtml(evolutionPathWithSprites) {
        // Check if the path is valid and has more than one stage
        if (!evolutionPathWithSprites || evolutionPathWithSprites.length <= 1) {
            return '<p class="no-evolution">This Pokémon does not evolve or data is unavailable.</p>';
        }

        // Build the HTML string
        let html = '<div class="evolution-chain-container">';
        evolutionPathWithSprites.forEach((stage, index) => {
            // Add data-id to the div for click handling
            // Use stage.sprite which was added in showPokemonDetails
            html += `
                <div class="evolution-stage" data-id="${stage.id}" title="View ${stage.name}">
                    <img src="${stage.sprite || 'placeholder.png'}" alt="${stage.name}" onerror="this.src='placeholder.png'; this.alt='Image missing';">
                    <span class="evolution-name">${stage.name}</span>
                </div>
            `;
            // Add arrow if not the last stage
            if (index < evolutionPathWithSprites.length - 1) {
                html += '<span class="evolution-arrow">→</span>';
            }
        });
        html += '</div>';
        return html;
    }

    // Generates the HTML string for the grid of older generation sprites
    function createGenerationalSpritesHtml(versionsData) {
        // Define the order generations should appear in
        const generationOrder = [
           'generation-i', 'generation-ii', 'generation-iii',
           'generation-iv', 'generation-v', 'generation-vi',
           'generation-vii', 'generation-viii'
        ];
        // Map API game keys to more readable names
        const gameNames = {
            'red-blue': 'R/B', 'yellow': 'Y',
            'gold': 'G', 'silver': 'S', 'crystal': 'C',
            'ruby-sapphire': 'R/S', 'emerald': 'E', 'firered-leafgreen': 'FR/LG',
            'diamond-pearl': 'D/P', 'platinum': 'Pt', 'heartgold-soulsilver': 'HG/SS',
            'black-white': 'B/W',
            'omegaruby-alphasapphire': 'OR/AS', 'x-y': 'X/Y',
            'ultra-sun-ultra-moon': 'US/UM', 'sun-moon': 'S/M',
            'icons': 'Icons' // Often small menu sprites
        };

        let html = '<div class="generation-grid">';
        let spritesFound = false; // Flag to check if any sprites were added

        generationOrder.forEach(genKey => {
            if (versionsData[genKey]) { // Check if data exists for this generation
               const genSpritesHtml = Object.entries(versionsData[genKey])
                   // Iterate through games within the generation
                   .map(([gameKey, gameSprites]) => {
                       let spriteUrl = gameSprites.front_default;
                       let gameDisplayName = gameNames[gameKey] || gameKey.replace('-', ' '); // Use mapped name or format key
                       let altText = `${gameDisplayName} sprite`;

                       // Special case for Black/White animated sprites
                       if (!spriteUrl && gameKey === 'black-white' && gameSprites.animated?.front_default) {
                            spriteUrl = gameSprites.animated.front_default;
                            altText = `${gameDisplayName} animated sprite`;
                       }

                       // If we have a valid sprite URL, create the HTML
                       if (spriteUrl) {
                           spritesFound = true; // Mark that we found at least one sprite
                           return `
                               <div class="game-sprite-container" title="${gameDisplayName}">
                                   <img
                                     src="${spriteUrl}"
                                     alt="${altText}"
                                     onerror="this.parentElement.style.display='none';"
                                   >
                               </div>`;
                       }
                       return ''; // Return empty string if no usable sprite found
                   }).join(''); // Join the HTML for all games in this generation

                // If we generated any HTML for sprites in this generation, wrap it in a group div
                if (genSpritesHtml.trim() !== '') {
                     const genDisplayName = genKey.replace('generation-', 'Gen ').replace('i','I').replace('v','V'); // Format Gen Name
                     html += `
                        <div class="generation-group">
                             <h4>${genDisplayName}</h4>
                             ${genSpritesHtml}
                        </div>`;
                }
            }
        });

        // If the loop completes and no sprites were found at all, show a message
        if (!spritesFound) {
            html += '<p class="no-gen-sprites">No older generation sprites available in API data.</p>';
        }

        html += '</div>';
        return html;
   }


    // Creates the HTML for the stat bars section
     function createStatsHtml(stats) {
        return stats.map(statInfo => {
            const statName = statInfo.stat.name;
            const statValue = statInfo.base_stat;
            // Calculate percentage width for the bar, capped at 100%
            const statPercentage = Math.min((statValue / MAX_STAT_VALUE) * 100, 100);
            // Create a CSS-friendly class name (e.g., special-attack -> specialattack)
            const statClass = statName.replace(/[^a-zA-Z0-9]/g, '');

            return `
                <div class="stat-item stat-${statClass}">
                    <span class="stat-name">${statName.replace('-', ' ')}</span>
                    <div class="stat-bar-container">
                        <div class="stat-bar" style="width: ${statPercentage}%;">
                            <!-- Optional: Can add value inside bar later if needed -->
                        </div>
                    </div>
                    <span class="stat-value">${statValue}</span>
                </div>
            `;
        }).join('');
    }

    // Main function called when a Pokémon card is clicked
    async function showPokemonDetails(id) {
        // Show modal and initial loading message
        modalBody.innerHTML = '<div class="modal-loading">Loading details...</div>';
        modal.style.display = 'block';
        body.style.overflow = 'hidden'; // Prevent background scrolling when modal is open

        // --- Fetch all necessary data ---
        const data = await fetchDetailedPokemonData(id);

        // Handle fetch failure for base data
        if (!data) {
            modalBody.innerHTML = '<div class="modal-error">Could not load Pokémon base details. Please try again later.</div>';
            body.style.overflow = ''; // Restore scrolling on error
            return;
        }

        // --- Fetch Evolution Data and Sprites in parallel ---
        let evolutionHtml = '<div class="modal-loading">Loading evolution...</div>'; // Placeholder
        if (data.species?.url) {
            try {
                const evolutionChainStart = await fetchEvolutionChainData(data.species.url);
                if (evolutionChainStart) {
                    const evolutionPath = parseEvolutionChain(evolutionChainStart); // Path with names & IDs

                    // Fetch sprites for each stage concurrently
                    const spritePromises = evolutionPath.map(stage => fetchMinimalPokemonData(stage.id));
                    const evolutionSpritesData = await Promise.all(spritePromises);

                    // Combine original path data (name, id) with fetched sprite data
                    const evolutionPathWithSprites = evolutionPath.map((stage, index) => ({
                        ...stage, // Keep name and id
                        sprite: evolutionSpritesData[index]?.sprite // Add sprite (uses fallback if fetch failed)
                    }));

                    evolutionHtml = createEvolutionHtml(evolutionPathWithSprites); // Generate HTML with sprites
                } else {
                    evolutionHtml = '<p class="no-evolution">No evolution data found for this species.</p>';
                }
            } catch (error) {
                 console.error("Error processing evolution chain:", error);
                 evolutionHtml = '<p class="no-evolution">Error loading evolution data.</p>';
            }
        } else {
            evolutionHtml = '<p class="no-evolution">Species data unavailable, cannot fetch evolution.</p>';
        }

        // --- Generate other HTML parts ---
        const statsHtml = createStatsHtml(data.stats);
        const generationalSpritesHtml = createGenerationalSpritesHtml(data.sprites.versions || {});

        // --- Populate the modal with the generated HTML ---
         modalBody.innerHTML = `
            <div class="modal-pokemon-header">
                <div class="modal-pokemon-name">${data.name}</div>
                <div class="modal-pokemon-id">#${data.id.toString().padStart(4, '0')}</div>
                <div class="modal-pokemon-types">
                    ${data.types.map(typeInfo => `<span class="type-badge type-${typeInfo.type.name}">${typeInfo.type.name}</span>`).join('')}
                </div>
            </div>

            <div class="modal-sprites">
                <div>
                    <img src="${data.sprites.front_default || 'placeholder.png'}" alt="${data.name} default sprite" onerror="this.src='placeholder.png'; this.alt='Not found';">
                    <span>Default</span>
                </div>
                 <div>
                    <img src="${data.sprites.front_shiny || 'placeholder.png'}" alt="${data.name} shiny sprite" onerror="this.src='placeholder.png'; this.alt='Not found';">
                     <span>Shiny</span>
                 </div>
                 ${data.sprites.back_default ? `
                 <div>
                    <img src="${data.sprites.back_default}" alt="${data.name} back sprite" onerror="this.src='placeholder.png'; this.alt='Not found';">
                     <span>Back</span>
                 </div>` : ''}
                  ${data.sprites.back_shiny ? `
                 <div>
                    <img src="${data.sprites.back_shiny}" alt="${data.name} shiny back sprite" onerror="this.src='placeholder.png'; this.alt='Not found';">
                     <span>Shiny Back</span>
                 </div>` : ''}
            </div>

            <div class="modal-stats">
                <h3>Base Stats</h3>
                ${statsHtml}
            </div>

            <div class="modal-evolutions">
                 <h3>Evolution Chain</h3>
                 ${evolutionHtml}
            </div>

            <div class="modal-generational-sprites">
                 <h3>Older Game Sprites</h3>
                 ${generationalSpritesHtml}
            </div>
        `;

        // Note: The event listener for evolution clicks is added *once* below, using delegation.
    }


    // --- Event Delegation for Clicks within Modal Body ---
    // This single listener handles clicks on any current or future .evolution-stage inside the modal
    modalBody.addEventListener('click', (event) => {
        // Check if the clicked element or its parent is an .evolution-stage with a data-id
        const evolutionStage = event.target.closest('.evolution-stage[data-id]');

        if (evolutionStage) {
            const pokemonIdToLoad = evolutionStage.dataset.id;
            console.log(`Evolution stage clicked: Loading Pokémon ID ${pokemonIdToLoad}`);
            // Load the clicked Pokémon's details into the *same* modal
            showPokemonDetails(pokemonIdToLoad);
        }
    });


    // Closes the modal
    function closeModal() {
        modal.style.display = 'none';
        modalBody.innerHTML = ''; // Clear content
        body.style.overflow = ''; // Restore background scrolling
    }

    // --- Event Listeners ---

    // Filter listeners
    searchInput.addEventListener('input', applyFilters);
    clearFiltersButton.addEventListener('click', clearTypeFilters);

    // Modal close listeners
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { // Close if click outside modal content
        if (event.target == modal) {
            closeModal();
        }
    });
    window.addEventListener('keydown', (event) => { // Close with Escape key
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });


    // --- Initialization ---
    fetchAllPokemon(); // Start the application by fetching the Pokémon list

}); // End of DOMContentLoaded
