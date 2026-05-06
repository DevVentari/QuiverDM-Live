import json
import os
import re

def clean_trait_name(name):
    name = name.replace('**', '').strip()
    # Remove leading non-alphanumeric characters except ( [ {
    name = re.sub(r'^[^a-zA-Z0-9(\[\{]+', '', name)
    return name

def process_npcs(npcs_data):
    processed = []
    for npc in npcs_data:
        # Initialize properties
        properties = {
            'mechanics': npc.get('mechanics', {}),
            'traits': [],
            'actions': npc.get('actions', []),
            'ability_scores': npc.get('ability_scores', {}),
            'personality': npc.get('personality', ''),
            'ideals': npc.get('ideals', ''),
            'bonds': npc.get('bonds', ''),
            'flaws': npc.get('flaws', ''),
            'type_alignment': npc.get('type_alignment', '')
        }
        
        # Merge traits into mechanics or description if they look like stats
        for trait in npc.get('traits', []):
            name = trait.get('name', '')
            desc = trait.get('description', '')
            
            # Handle cases where stats are in the trait name
            if 'Armor Class**' in name or 'Hit Points**' in name:
                # Extract stats from name
                ac_match = re.search(r'Armor Class\*\* ([\d\s(a-zA-Z)]+)', name)
                hp_match = re.search(r'Hit Points\*\* ([\d\s(a-zA-Z\+)]+)', name)
                speed_match = re.search(r'Speed\*\* ([\d\s(a-zA-Z,)]+)', name)
                
                if ac_match: properties['mechanics']['armor_class'] = ac_match.group(1).strip()
                if hp_match: properties['mechanics']['hit_points'] = hp_match.group(1).strip()
                if speed_match: properties['mechanics']['speed'] = speed_match.group(1).strip()
                
                # Extract ability scores if present
                for stat in ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']:
                    stat_match = re.search(fr'{stat}\*\* ([\d\s\(\+\-\)]+)', name)
                    if stat_match:
                        properties['ability_scores'][stat] = stat_match.group(1).strip()
                
                # Extract senses, languages, challenge
                senses_match = re.search(r'Senses\*\* ([^|\n]+)', name)
                lang_match = re.search(r'Languages\*\* ([^|\n]+)', name)
                cr_match = re.search(r'Challenge\*\* ([^|\n]+)', name)
                
                if senses_match: properties['mechanics']['senses'] = senses_match.group(1).strip()
                if lang_match: properties['mechanics']['languages'] = lang_match.group(1).strip()
                if cr_match: properties['mechanics']['challenge_rating'] = cr_match.group(1).strip()
                
                # The actual trait name is at the end
                real_name_parts = name.split('**')
                if len(real_name_parts) > 1:
                    name = real_name_parts[-1].strip()

            # Handle "The Knowledge Serpent" embedded in description or traits
            if '# The Knowledge Serpent' in desc:
                parts = desc.split('# The Knowledge Serpent')
                desc = parts[0].strip()
                # We should really create a new NPC here, but for simplicity of the script 
                # we'll just keep the main NPC and note the sub-entity
                
            name = clean_trait_name(name)
            if name:
                properties['traits'].append({'name': name, 'description': desc})
        
        # Move extra fields to properties
        for key in ['how_he_presents']:
            if key in npc:
                properties[key] = npc[key]
        
        processed.append({
            'name': npc['name'],
            'type': 'NPC',
            'description': npc.get('description') or npc.get('personality') or npc.get('type_alignment') or '',
            'properties': properties
        })
    return processed

def parse_markdown_entities(content, entity_type):
    entities = []
    # Split by ## Header
    sections = re.split(r'\n##\s+', '\n' + content)
    for section in sections:
        if not section.strip(): continue
        lines = section.strip().split('\n')
        name = lines[0].strip()
        body = '\n'.join(lines[1:]).strip()
        
        properties = {}
        
        # Extract table data
        table_match = re.search(r'\| Aspect \| Details \|\n\|[-| ]+\|\n((?:\|.*\|\n?)+)', body)
        if table_match:
            table_body = table_match.group(1)
            for row in table_body.strip().split('\n'):
                cols = [c.strip() for c in row.split('|') if c.strip()]
                if len(cols) >= 2:
                    key = cols[0].replace('**', '').strip()
                    val = cols[1].strip()
                    properties[key] = val
            description = body.replace(table_match.group(0), '').strip()
        else:
            description = body
            
        entities.append({
            'name': name,
            'type': entity_type,
            'description': description,
            'properties': properties
        })
    return entities

def main():
    base_path = r'E:\Projects\QuiverDM\docs\hameria-ire-jsons'
    
    campaign = {
        "name": "Hameria Ire",
        "slug": "hameria-ire",
        "description": "A world where time was stopped fourteen centuries ago to prevent a cosmic collapse. The Sunward Empire maintains the binding, while the world slowly withers under the weight of the unpaid temporal debt."
    }
    
    world_entities = []
    
    # NPCs
    try:
        with open(os.path.join(base_path, 'npcs_npcs.json'), 'r', encoding='utf-8') as f:
            npcs_data = json.load(f)['data']
            world_entities.extend(process_npcs(npcs_data))
    except Exception as e:
        print(f"Error processing NPCs: {e}")
        
    # Monsters
    try:
        with open(os.path.join(base_path, 'bestiary_monsters.json'), 'r', encoding='utf-8') as f:
            monsters_data = json.load(f)['data']
            world_entities.extend(process_npcs(monsters_data))
    except Exception as e:
        print(f"Error processing Monsters: {e}")
        
    # Factions
    try:
        with open(os.path.join(base_path, 'Factions.json'), 'r', encoding='utf-8') as f:
            factions_content = json.load(f)['content']
            world_entities.extend(parse_markdown_entities(factions_content, 'FACTION'))
    except Exception as e:
        print(f"Error processing Factions: {e}")
        
    # Locations
    try:
        with open(os.path.join(base_path, 'Locations.json'), 'r', encoding='utf-8') as f:
            locations_content = json.load(f)['content']
            world_entities.extend(parse_markdown_entities(locations_content, 'LOCATION'))
    except Exception as e:
        print(f"Error processing Locations: {e}")
        
    homebrew_content = []
    
    # Races
    try:
        with open(os.path.join(base_path, 'mechanics_races.json'), 'r', encoding='utf-8') as f:
            races_data = json.load(f)['data']
            for race in races_data:
                homebrew_content.append({
                    'name': race['name'],
                    'type': 'race',
                    'data': {
                        'description': race.get('description'),
                        'traits': race.get('traits'),
                        'subraces': race.get('subraces')
                    }
                })
    except Exception as e:
        print(f"Error processing Races: {e}")
            
    # Items
    item_file = os.path.join(base_path, 'mechanics_items.json')
    if os.path.exists(item_file):
        try:
            with open(item_file, 'r', encoding='utf-8') as f:
                items_data = json.load(f).get('data', [])
                for item in items_data:
                    homebrew_content.append({
                        'name': item['name'],
                        'type': 'item',
                        'data': item
                    })
        except Exception as e:
            print(f"Error processing Items: {e}")

    adventures = []
    try:
        adventure_files = [f for f in os.listdir(base_path) if f.startswith('adventures_') and f.endswith('.json')]
        for adv_file in adventure_files:
            with open(os.path.join(base_path, adv_file), 'r', encoding='utf-8') as f:
                adv_json = json.load(f)
                adventures.append({
                    'name': adv_json['metadata']['title'],
                    'description': adv_json.get('content', '')[:1000] + '...',
                    'status': 'planning',
                    'metadata': adv_json['metadata']
                })
    except Exception as e:
        print(f"Error processing Adventures: {e}")

    seed = {
        'campaign': campaign,
        'worldEntities': world_entities,
        'homebrewContent': homebrew_content,
        'adventures': adventures
    }
    
    output_path = os.path.join(base_path, 'hameria-ire-seed.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(seed, f, indent=2)

    print(f"Processed {len(world_entities)} world entities.")
    print(f"Processed {len(homebrew_content)} homebrew items.")
    print(f"Processed {len(adventures)} adventures.")
    print(f"Seed file saved to {output_path}")

if __name__ == "__main__":
    main()
